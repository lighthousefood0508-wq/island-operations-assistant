import { randomUUID } from "node:crypto";
import { CostUnit } from "../domain/cost-unit.js";
import { CostPurchaseInvalidState, CostPurchaseVersionConflict, CostDomainError } from "../domain/errors.js";
import { ExactDecimal } from "../domain/exact-decimal.js";
import { IngredientId, PurchaseId, PurchaseLineId, SupplierId } from "../domain/identities.js";
import type { CostPurchaseRepository } from "../domain/purchase-repository.js";
import { CostPurchase, type CostPurchaseContractV1, type CostPurchaseLineInput } from "../domain/purchase.js";
import type { CostSupplierRepository } from "../domain/supplier-repository.js";
import { CostPurchaseInvalidStateFailure, CostPurchaseNotFound, CostPurchasePersistenceFailure, CostPurchaseValidationFailure, CostPurchaseVersionConflictFailure } from "./cost-purchase-errors.js";

type RawLine = Readonly<{ ingredientId: string; quantityCoefficient: string; quantityScale: number; unitCode: string }>;
export type CreateCostPurchaseCommand = Readonly<{ supplierId: string; lines: readonly RawLine[]; occurredAt: string; actor: string }>;
export type ReviseCostPurchaseCommand = Readonly<{ purchaseId: string; expectedVersion: number; lines: readonly RawLine[]; occurredAt: string; actor: string }>;
export type RecordCostPurchaseCommand = Readonly<{ purchaseId: string; expectedVersion: number; recordedAt: string; recordedBy: string }>;
function text(value:string):string{if(typeof value!=="string"||value.trim().length===0)throw new CostPurchaseValidationFailure();return value.trim();}
function lines(raw:readonly RawLine[]):readonly CostPurchaseLineInput[]{if(!Array.isArray(raw))throw new CostPurchaseValidationFailure();try{return Object.freeze(raw.map(line=>Object.freeze({lineId:PurchaseLineId.fromUuid(randomUUID()),ingredientId:IngredientId.parse(text(line.ingredientId)),quantity:ExactDecimal.create(text(line.quantityCoefficient),line.quantityScale),unit:CostUnit.create(text(line.unitCode))})));}catch{throw new CostPurchaseValidationFailure();}}
export class CostPurchaseService {
  constructor(private readonly purchases: CostPurchaseRepository, private readonly suppliers: Pick<CostSupplierRepository,"findById">) {}
  create(command:CreateCostPurchaseCommand):CostPurchaseContractV1 { try { const supplierId=SupplierId.parse(text(command.supplierId)); if(this.suppliers.findById(supplierId)===undefined)throw new CostPurchaseValidationFailure(); const purchase=CostPurchase.createDraft({purchaseId:PurchaseId.fromUuid(randomUUID()),supplierId,lines:lines(command.lines),createdAt:text(command.occurredAt),createdBy:text(command.actor)}); this.purchases.saveNew(purchase); return purchase.toContract(); } catch(error) { throw this.map(error); } }
  revise(command:ReviseCostPurchaseCommand):CostPurchaseContractV1 { try { const purchase=this.required(command.purchaseId); purchase.assertExpectedVersion(command.expectedVersion); purchase.revise(lines(command.lines),text(command.occurredAt),text(command.actor)); this.purchases.saveWithExpectedVersion(purchase,command.expectedVersion); return purchase.toContract(); } catch(error) { throw this.map(error); } }
  record(command:RecordCostPurchaseCommand):CostPurchaseContractV1 { try { const purchase=this.required(command.purchaseId); purchase.assertExpectedVersion(command.expectedVersion); purchase.record(text(command.recordedAt),text(command.recordedBy)); this.purchases.saveWithExpectedVersion(purchase,command.expectedVersion); return purchase.toContract(); } catch(error) { throw this.map(error); } }
  private required(value:string):CostPurchase { const found=this.purchases.findById(PurchaseId.parse(text(value))); if(found===undefined)throw new CostPurchaseNotFound();return found; }
  private map(error:unknown):Error { if(error instanceof CostPurchaseValidationFailure||error instanceof CostPurchaseNotFound||error instanceof CostPurchaseInvalidStateFailure||error instanceof CostPurchaseVersionConflictFailure||error instanceof CostPurchasePersistenceFailure)return error; if(error instanceof CostPurchaseVersionConflict)return new CostPurchaseVersionConflictFailure(); if(error instanceof CostPurchaseInvalidState)return new CostPurchaseInvalidStateFailure(); if(error instanceof CostDomainError)return new CostPurchaseValidationFailure(); return new CostPurchasePersistenceFailure(); }
}
