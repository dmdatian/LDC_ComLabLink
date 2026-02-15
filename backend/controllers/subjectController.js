const { db } = require('../config/database');

const getSubjects = async (req, res) => {
  try {
    const snapshot = await db.collection('subjects').get();
    const subjects = snapshot.docs
      .map((doc) => doc.data().name)
      .filter((name) => typeof name === 'string' && name.trim().length > 0);
    res.json({ success: true, subjects });
  } catch (err) {
    console.error('Error fetching subjects:', err);
    res.json({ success: false, subjects: [] });
  }
};

module.exports = { getSubjects };