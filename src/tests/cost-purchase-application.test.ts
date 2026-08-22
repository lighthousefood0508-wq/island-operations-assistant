import assert from "node:assert/strict";
import test from "node:test";
import { CostPurchaseService, CostSupplier, SupplierId } from "../domains/cost/index.js";
class Purchases { saved:any[]=[]; saveNew(p:any){this.saved.push(p)} findById(id:any){return this.saved.find(p=>p.purchaseId.equals(id))} saveWithExpectedVersion(){} }
const supplier=CostSupplier.create({supplierId:SupplierId.fromUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),displayName:"S",createdAt:"2026-08-22T00:00:00.000Z",createdBy:"o"});
test("Cost Purchase Service creates Draft only for an existing formal Supplier",()=>{const purchases=new Purchases();const service=new CostPurchaseService(purchases,{findById:()=>supplier});const result=service.create({supplierId:supplier.supplierId.value,lines:[{ingredientId:"ing_bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",quantityCoefficient:"10",quantityScale:0,unitCode:"kg"}],occurredAt:"2026-08-22T00:00:00.000Z",actor:"o"});assert.equal(result.state,"Draft");assert.equal(purchases.saved.length,1);});
