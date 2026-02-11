// models/Class.js
const { db } = require('../config/database');

// CLASS MODEL: Firestore access for class schedules
class Class {
  // Create a new class
  static async create(classData) {
    try {
      const timestamp = new Date();
      const docRef = await db.collection('classes').add({
        teacherId: classData.teacherId,
        className: classData.className,
        startTime: new Date(classData.startTime),
        endTime: new Date(classData.endTime),
        date: classData.date,
        capacity: classData.capacity || 30,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      throw error;
    }
  }

  // Get class by ID
  static async getById(id) {
    try {
      const doc = await db.collection('classes').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  // Get all classes by teacher
  static async getByTeacherId(teacherId) {
    try {
      const snapshot = await db.collection('classes')
        .where('teacherId', '==', teacherId)
        .get();
      const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return classes.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    } catch (error) {
      throw error;
    }
  }

  // Get all classes by date
  static async getByDate(date) {
    try {
      const snapshot = await db.collection('classes')
        .where('date', '==', date)
        .get();
      const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return classes.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    } catch (error) {
      throw error;
    }
  }

  

  // Update class
  static async update(id, data) {
    try {
      const classRef = db.collection('classes').doc(id);
      const doc = await classRef.get();
      if (!doc.exists) return { success: false, message: 'Class not found' };

      await classRef.update({
        ...data,
        updatedAt: new Date(),
      });
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Delete class
  static async delete(id) {
    try {
      const classRef = db.collection('classes').doc(id);
      const doc = await classRef.get();
      if (!doc.exists) return { success: false, message: 'Class not found' };

      await classRef.delete();
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Class;
