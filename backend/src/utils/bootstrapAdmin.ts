import bcrypt from 'bcryptjs';
import { User } from '../models/User';

interface AdminEntry {
  email: string;
  password: string;
  name: string;
}

function parseAdminEntries(): AdminEntry[] {
  const entries: AdminEntry[] = [];

  // New multi-admin format: ADMIN_EMAILS, ADMIN_PASSWORDS, ADMIN_NAMES
  const emails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean) || [];
  const passwords = process.env.ADMIN_PASSWORDS?.split(',').map((p) => p.trim()).filter(Boolean) || [];
  const names = process.env.ADMIN_NAMES?.split(',').map((n) => n.trim()).filter(Boolean) || [];

  for (let i = 0; i < emails.length; i++) {
    if (emails[i] && passwords[i]) {
      entries.push({
        email: emails[i].toLowerCase(),
        password: passwords[i],
        name: names[i] || 'Admin User',
      });
    }
  }

  // Legacy single-admin fallback: ADMIN_EMAIL, ADMIN_PASSWORD
  if (entries.length === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    entries.push({
      email: process.env.ADMIN_EMAIL.toLowerCase(),
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME || 'Admin User',
    });
  }

  return entries;
}

async function ensureAdmin(entry: AdminEntry): Promise<void> {
  const existing = await User.findOne({ email: entry.email });

  if (existing) {
    if (existing.role === 'admin') {
      console.log(`🔐 Admin already exists: ${entry.email}`);
      return;
    }
    // Upgrade existing user to admin
    existing.role = 'admin';
    existing.password = await bcrypt.hash(entry.password, 10);
    existing.verified = true;
    await existing.save();
    console.log(`🔐 User upgraded to admin: ${entry.email}`);
    return;
  }

  // Create new admin user
  await User.create({
    name: entry.name,
    email: entry.email,
    phone: '0000000000',
    password: await bcrypt.hash(entry.password, 10),
    farmSize: 0,
    location: {
      state: 'Admin',
      district: 'Admin',
      coordinates: { latitude: 0, longitude: 0 },
    },
    soilType: 'N/A',
    waterSource: 'N/A',
    role: 'admin',
    crops: [],
    points: 0,
    verified: true,
  });

  console.log(`🔐 Admin account created: ${entry.email}`);
}

export const ensureBootstrapAdmin = async (): Promise<void> => {
  const admins = parseAdminEntries();

  if (admins.length === 0) {
    return;
  }

  for (const admin of admins) {
    await ensureAdmin(admin);
  }
};
