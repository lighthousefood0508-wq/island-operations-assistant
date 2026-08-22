import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createDatabase } from "../shared/database/database-provider.js";
import { runMigrations } from "../shared/database/migrate.js";
import { CostPurchase, CostUnit, ExactDecimal, IngredientId, PurchaseId, PurchaseLineId, SqliteCostPurchaseRepository, SupplierId } from "../domains/cost/index.js";
test("Migration 020 persists formal Purchase without touching legacy tables",()=>{const d=mkdtempSync(path.join(tmpdir(),"purchase-"));const db=createDatabase({databasePath:path.join(d,"x.sqlite"),host:"127.0.0.1",port:0});try{runMigrations(db);const supplier=SupplierId.fromUuid("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");db.execute("INSERT INTO cost_suppliers VALUES (?,?,?,?,?)",[supplier.value,"S","2026-08-22T00:00:00.000Z","o",0]);const p=CostPurchase.createDraft({purchaseId:PurchaseId.fromUuid("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),supplierId:supplier,lines:[{lineId:PurchaseLineId.fromUuid("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),ingredientId:IngredientId.fromUuid("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),quantity:ExactDecimal.create("1",0),unit:CostUnit.create("kg")}],createdAt:"2026-08-22T00:00:00.000Z",createdBy:"o"});const repo=new SqliteCostPurchaseRepository(db);repo.saveNew(p);assert.equal(repo.findById(p.purchaseId)?.toContract().state,"Draft");assert.equal(db.queryOne<{count:number}>("SELECT count(*) count FROM cost_purchases")?.count,0);}finally{db.close();rmSync(d,{recursive:true,force:true});}});
