import { initDatabase, getDatabase } from './src/database/init.js';

async function clearOldJobs() {
  try {
    await initDatabase();
    const db = getDatabase();
    
    console.log('Clearing all old jobs from database...');
    
    // Delete all jobs and their sources
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM job_sources', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM jobs', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ All old jobs cleared from database');
    console.log('The database is now empty and ready for fresh scraped jobs from the exact URL');
    
    process.exit(0);
  } catch (error) {
    console.error('Error clearing jobs:', error);
    process.exit(1);
  }
}

clearOldJobs();

