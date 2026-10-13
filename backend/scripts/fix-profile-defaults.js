const mongoose = require('mongoose');
const StudentProfile = require('../src/models/StudentProfile');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/student-portal');

  const result = await StudentProfile.updateMany(
    {
      $or: [
        { cgpa: 3.84 },
        { creditsCompleted: 48 },
        { hallResidence: 'CRIG Hall 3, Room 14B' },
      ],
    },
    {
      $set: {
        cgpa: 0,
        creditsCompleted: 0,
        hallResidence: '',
      },
    }
  );

  console.log(JSON.stringify({ matched: result.matchedCount, modified: result.modifiedCount }));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
