import type {
  RecipeCostingContractFailureCodeV2
} from "../contracts/recipe-costing-contract-v2.js";

export class RecipeCostingContractV2Error extends Error {
  constructor(
    readonly code: RecipeCostingContractFailureCodeV2,
    message: string
  ) {
    super(message);
    this.name = "RecipeCostingContractV2Error";
  }
}
