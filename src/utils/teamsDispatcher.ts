/**
 * Teams Integration Removed as requested by user.
 * Dummy stubs provided to ensure zero compilation or runtime breaks across existing imports.
 */

export const OFFICIAL_TEAMS_CHANNEL_URL = '';

export function openOfficialTeamsChannel() {
  // Removed
}

export interface TeamsLogEntry {
  id: string;
  timestamp: string;
  title: string;
  summaryText: string;
  status: 'SENT' | 'FAILED' | 'DISABLED';
}

export function getStoredTeamsLogs(): TeamsLogEntry[] {
  return [];
}

export function saveTeamsLog(_entry: TeamsLogEntry) {
  // Removed
}

export async function sendTeamsWebhook(
  _title: string,
  _facts: Array<{ name: string; value: string }>,
  _summaryText: string,
  _themeColor?: string
): Promise<boolean> {
  return true;
}

export async function sendDriverLoginToTeams(_driver: any, _truck: any): Promise<boolean> {
  return true;
}

export async function sendStandbyStartToTeams(_driver: any, _truck: any, _reason: any, _startTime: any): Promise<boolean> {
  return true;
}

export async function sendStandbyEndToTeams(_driver: any, _truck: any, _durationSeconds: any, _reason: any, _endTime: any): Promise<boolean> {
  return true;
}

export async function sendShiftHandoverToTeams(_handover: any): Promise<boolean> {
  return true;
}

export async function sendEquipmentAlertToTeams(_alert: any): Promise<boolean> {
  return true;
}

export async function sendHourlyExportToTeams(_snapshot: any): Promise<boolean> {
  return true;
}

export async function sendTestTeamsMessage(_customUrl?: string): Promise<{ success: boolean; message: string }> {
  return { success: true, message: 'تم إيقاف خدمة تيمز' };
}

export async function sendFuelingStartToTeams(_truckId: any, _driverName: any, _driverCode: any, _startTime: any): Promise<boolean> {
  return true;
}

export async function sendFuelingEndToTeams(_truckId: any, _driverName: any, _driverCode: any, _durationMinutes: any): Promise<boolean> {
  return true;
}

export async function sendDispatcherInstructionToTeams(_truckId: any, _messageText: any, _priority: any): Promise<boolean> {
  return true;
}

export async function sendProductionGapAlertToTeams(_alert: any): Promise<boolean> {
  return true;
}

export async function sendExcavatorLowPerformanceToTeams(_excavatorId: any, _currentTons: any, _targetTons: any, _gapPercent: any): Promise<boolean> {
  return true;
}

export async function sendPerformanceSummaryToTeams(_summaryText: string): Promise<boolean> {
  return true;
}
