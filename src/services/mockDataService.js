import usersData from '../data/users.json';
import vehiclesData from '../data/vehicles.json';
import applicationsData from '../data/applications.json';
import stickersData from '../data/stickers.json';
import entryLogsData from '../data/entryLogs.json';
import violationLogsData from '../data/violationLogs.json';
import notificationsData from '../data/notifications.json';
import reportsData from '../data/reports.json';
import scanResultsData from '../data/scanResults.json';
import visitsData from '../data/visits.json';

// Every function here simulates the async shape of a real API call
// (Firebase/PHP) so pages don't need to change when the real backend is
// wired up — only this file does. Data is read from the static JSON in
// src/data, not mutated on disk; "write" calls resolve as if they
// succeeded but only affect the in-memory copy for the current session.

function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Visits are the one dataset multiple roles genuinely need to read
// *and write* across separate pages in the same session (visitor
// registers -> admin approves -> guard checks in), so this one gets a
// real module-level mutable store instead of always reading straight
// from the JSON import. It resets on a full page reload, same as
// everything else here — this is still a mock, not real persistence.
let visitsStore = clone(visitsData);

export const mockDataService = {
  async getUsers() {
    await delay();
    return clone(usersData);
  },

  async getVehicles({ ownerId } = {}) {
    await delay();
    const rows = ownerId ? vehiclesData.filter((v) => v.ownerId === ownerId) : vehiclesData;
    return clone(rows);
  },

  async getVehicleById(vehicleId) {
    await delay();
    const vehicle = vehiclesData.find((v) => v.id === vehicleId);
    return vehicle ? clone(vehicle) : null;
  },

  async getApplications({ applicantId } = {}) {
    await delay();
    const rows = applicantId
      ? applicationsData.filter((a) => a.applicantId === applicantId)
      : applicationsData;
    return clone(rows);
  },

  async getApplicationById(applicationId) {
    await delay();
    const application = applicationsData.find((a) => a.id === applicationId);
    return application ? clone(application) : null;
  },

  async getStickers() {
    await delay();
    return clone(stickersData);
  },

  async getEntryLogs() {
    await delay();
    return clone(entryLogsData);
  },

  async getViolationLogs() {
    await delay();
    return clone(violationLogsData);
  },

  async getNotifications({ userId } = {}) {
    await delay();
    const rows = userId ? notificationsData.filter((n) => n.userId === userId) : notificationsData;
    return clone(rows);
  },

  async getReports() {
    await delay();
    return clone(reportsData);
  },

  async getScanResults() {
    await delay();
    return clone(scanResultsData);
  },

  /**
   * Simulates the full YOLOv8 + PP-OCRv3 + fuzzy-matching pipeline
   * described in Chapter III: capture -> detect sticker -> crop ->
   * extract serial -> fuzzy match -> compare to Firebase record. Real
   * inference will replace only this function's body.
   */
  async simulateScan() {
    await delay(1600);
    const pool = scanResultsData;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return clone({ ...pick, id: `scn_${Date.now()}`, timestamp: new Date().toISOString() });
  },

  async getVisits({ visitorId } = {}) {
    await delay();
    const rows = visitorId ? visitsStore.filter((v) => v.visitorId === visitorId) : visitsStore;
    return clone(rows);
  },

  async getVisitById(visitId) {
    await delay();
    const visit = visitsStore.find((v) => v.id === visitId);
    return visit ? clone(visit) : null;
  },

  async createVisit(payload) {
    await delay();
    const newVisit = {
      id: `visit_${Date.now()}`,
      status: 'pending',
      requestedDate: new Date().toISOString().slice(0, 10),
      approvedBy: null,
      approvedDate: null,
      reviewNotes: null,
      checkInTime: null,
      checkOutTime: null,
      ...payload,
    };
    visitsStore = [...visitsStore, newVisit];
    return clone(newVisit);
  },

  async updateVisit(visitId, patch) {
    await delay(300);
    visitsStore = visitsStore.map((v) => (v.id === visitId ? { ...v, ...patch } : v));
    return clone(visitsStore.find((v) => v.id === visitId));
  },

  async findVisitByPlate(plateNumber) {
    await delay(300);
    const normalized = plateNumber.trim().toUpperCase();
    // Prefer the most actionable match: an approved-but-not-checked-in
    // visit beats an already-completed one for the same plate.
    const matches = visitsStore.filter((v) => v.plateNumber.toUpperCase() === normalized);
    const priority = ['approved', 'inside_campus', 'pending', 'completed', 'rejected'];
    matches.sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status));
    return matches[0] ? clone(matches[0]) : null;
  },
};
