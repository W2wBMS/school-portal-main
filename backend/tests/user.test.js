const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User');
const StudentProfile = require('../src/models/StudentProfile');
const AdmissionList = require('../src/models/AdmissionList');
const authRouter = require('../src/routes/auth');
const v1Router = require('../src/routes/v1');
const { parseAdmissionsCsv } = require('../src/utils/admissions');
const { syncPendingAdmissionOffers } = require('../src/utils/admissionOffers');

let memoryServer;

async function connectTestDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    return;
  }

  if (!memoryServer) {
    memoryServer = await MongoMemoryServer.create();
  }

  await mongoose.connect(memoryServer.getUri('student-portal-test'));
}

async function disconnectTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

test.after(async () => {
  await disconnectTestDatabase();
  if (memoryServer) {
    await memoryServer.stop();
  }
});

test('User password hashes during save without a next callback', async () => {
  await connectTestDatabase();
  await mongoose.connection.db.dropDatabase().catch(() => {});

  const user = new User({
    fullName: 'Test User',
    email: 'test.user@example.com',
    password: 'StrongPass123',
    role: 'student',
  });

  await user.save();

  assert.notEqual(user.password, 'StrongPass123');
  assert.ok(user.password.length > 20);

  await User.deleteMany({});
  await disconnectTestDatabase();
});

test('User generates an 8-digit student index starting with 1029 when no ID is provided', async () => {
  await connectTestDatabase();
  await mongoose.connection.db.dropDatabase().catch(() => {});

  const firstUser = new User({
    fullName: 'Index One',
    email: 'index.one@example.com',
    password: 'StrongPass123',
    role: 'student',
  });

  const secondUser = new User({
    fullName: 'Index Two',
    email: 'index.two@example.com',
    password: 'StrongPass123',
    role: 'student',
  });

  await firstUser.save();
  await secondUser.save();

  assert.match(firstUser.studentId, /^1029\d{4}$/);
  assert.equal(firstUser.studentId.length, 8);
  assert.match(secondUser.studentId, /^1029\d{4}$/);
  assert.equal(secondUser.studentId.length, 8);
  assert.notEqual(firstUser.studentId, secondUser.studentId);

  await User.deleteMany({});
  await disconnectTestDatabase();
});

test('New student profiles default to zero CGPA and credits completed', async () => {
  await connectTestDatabase();
  await mongoose.connection.db.dropDatabase().catch(() => {});

  const user = new User({
    fullName: 'New Student',
    email: 'new.student@example.com',
    password: 'StrongPass123',
    role: 'student',
  });

  await user.save();

  const profile = await StudentProfile.create({
    userId: user._id,
    studentId: user.studentId,
    fullName: user.fullName,
    email: user.email,
  });

  assert.equal(profile.cgpa, 0);
  assert.equal(profile.creditsCompleted, 0);
  assert.equal(profile.hallResidence, '');
  assert.equal(profile.programme, '');
  assert.equal(profile.department, '');
  assert.equal(profile.level, '');
  assert.equal(profile.admissionOfferStatus, 'not_offered');

  await StudentProfile.deleteMany({});
  await User.deleteMany({});
  await disconnectTestDatabase();
});

test('student can accept a pending admission offer and the accepted date is saved', async () => {
  await connectTestDatabase();
  await mongoose.connection.db.dropDatabase().catch(() => {});
  const profile = await StudentProfile.create({
    userId: new mongoose.Types.ObjectId(),
    studentId: '10290007',
    fullName: 'Offer Student',
    email: 'offer.student@example.com',
    admissionOfferStatus: 'pending',
  });
  const route = v1Router.stack.find((layer) => layer.route?.path === '/students/me/admission-offer/accept');
  assert.ok(route, 'admission offer acceptance route is registered');
  const handler = route.route.stack.at(-1).handle;
  let responseStatus = 200;
  let responseBody;
  const res = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await handler({ user: { _id: profile.userId } }, res);

  assert.equal(responseStatus, 200);
  assert.equal(responseBody.profile.admissionOfferStatus, 'accepted');
  assert.ok(responseBody.profile.admissionOfferAcceptedAt);
  await StudentProfile.deleteMany({});
  await disconnectTestDatabase();
});

test('admission records backfill existing matching profiles without changing accepted offers', async () => {
  await connectTestDatabase();
  await mongoose.connection.db.dropDatabase().catch(() => {});
  const records = parseAdmissionsCsv('fullName,programme,department,level\nOffer Student,Computer Science,Computing,100\nDefault Student,Environmental Science,Environment,100');
  const pendingProfile = await StudentProfile.create({
    userId: new mongoose.Types.ObjectId(),
    studentId: '10290007',
    fullName: 'Offer Student',
    email: 'offer.student@example.com',
    programme: 'Computer Science',
    department: 'Computing',
    level: 'Level 100',
  });
  const acceptedProfile = await StudentProfile.create({
    userId: new mongoose.Types.ObjectId(),
    studentId: '10290008',
    fullName: 'Offer Student',
    email: 'accepted.student@example.com',
    programme: 'Computer Science',
    department: 'Computing',
    level: 'Level 100',
    admissionOfferStatus: 'accepted',
    admissionOfferAcceptedAt: new Date(),
  });
  const legacyProfileId = new mongoose.Types.ObjectId();
  await StudentProfile.collection.insertOne({
    _id: legacyProfileId,
    userId: new mongoose.Types.ObjectId(),
    studentId: '10290009',
    fullName: 'Offer Student',
    email: 'legacy.offer.student@example.com',
    programme: 'Computer Science',
    department: 'Computing',
    level: 'Level 100',
    status: 'registered',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const defaultUser = await User.create({
    fullName: 'Default Student',
    email: 'default.student@example.com',
    password: 'StrongPass123',
    role: 'student',
  });
  const defaultProfileId = new mongoose.Types.ObjectId();
  await StudentProfile.collection.insertOne({
    _id: defaultProfileId,
    userId: defaultUser._id,
    studentId: defaultUser.studentId,
    fullName: defaultUser.fullName,
    email: defaultUser.email,
    programme: 'Diploma in Agronomy & Cocoa Extension',
    department: 'Agronomy',
    level: '200 (Year 2)',
    status: 'registered',
    admissionOfferStatus: 'not_offered',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(await syncPendingAdmissionOffers(records), 1);
  assert.equal((await StudentProfile.findById(legacyProfileId)).admissionOfferStatus, 'pending');
  assert.equal(await syncPendingAdmissionOffers(records, { includeNotOffered: true }), 2);
  assert.equal((await StudentProfile.findById(pendingProfile._id)).admissionOfferStatus, 'pending');
  assert.equal((await StudentProfile.findById(acceptedProfile._id)).admissionOfferStatus, 'accepted');
  const migratedProfile = await StudentProfile.findById(defaultProfileId);
  assert.equal(migratedProfile.programme, 'Environmental Science');
  assert.equal(migratedProfile.department, 'Environment');
  assert.equal(migratedProfile.level, '100');
  assert.equal((await User.findById(defaultUser._id)).level, '100');
  await StudentProfile.deleteMany({});
  await User.deleteMany({});
  await disconnectTestDatabase();
});

test('Admissions lookup accepts a numeric level when the imported record stores Level 100', async () => {
  await connectTestDatabase();
  await mongoose.connection.db.dropDatabase().catch(() => {});

  const records = parseAdmissionsCsv('fullName,programme,department,level,email\nTest Student,Computer Science,Computing,Level 100,test.student@example.com');
  await AdmissionList.create({ key: 'active', records });

  const record = await authRouter.findAdmissionRecord('Test Student', 'Computer Science', 'Computing', '100');
  assert.ok(record);
  assert.equal(record.fullName, 'Test Student');

  await AdmissionList.deleteMany({});
  await disconnectTestDatabase();
});
