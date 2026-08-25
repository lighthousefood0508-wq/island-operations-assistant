export class DailyReportReadValidationFailure extends Error {
  constructor() { super("Daily Report identity is invalid."); this.name = "DailyReportReadValidationFailure"; }
}

export class DailyReportReadNotFound extends Error {
  constructor() { super("Daily Report was not found."); this.name = "DailyReportReadNotFound"; }
}

export class DailyReportReadPersistenceFailure extends Error {
  constructor() { super("Daily Report evidence could not be read."); this.name = "DailyReportReadPersistenceFailure"; }
}
