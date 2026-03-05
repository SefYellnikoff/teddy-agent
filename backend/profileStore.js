const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PROFILE_FILE = path.join(DATA_DIR, 'child-profile.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeProfile(input = {}) {
  return {
    childName: String(input.childName || '').trim(),
    ageGroup: String(input.ageGroup || '').trim(),
    englishLevel: String(input.englishLevel || '').trim(),
    sessionMinutes: Number.isFinite(Number(input.sessionMinutes)) ? Number(input.sessionMinutes) : 10,
    updatedAt: new Date().toISOString(),
  };
}

function readProfile() {
  try {
    if (!fs.existsSync(PROFILE_FILE)) return null;
    const raw = fs.readFileSync(PROFILE_FILE, 'utf8');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read child profile:', error);
    return null;
  }
}

function saveProfile(profileInput) {
  ensureDataDir();
  const profile = normalizeProfile(profileInput);
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf8');
  return profile;
}

module.exports = {
  readProfile,
  saveProfile,
};
