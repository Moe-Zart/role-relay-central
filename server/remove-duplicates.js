import { initDatabase, getDatabase } from './src/database/init.js';
import logger from './src/utils/logger.js';

async function removeDuplicates() {
  try {
    await initDatabase();
    const db = getDatabase();
    
    console.log('🔍 Finding and removing duplicate jobs...');
    
    // Find all jobs with their URLs
    const allJobs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          j.id,
          j.title,
          j.company,
          j.posted_at,
          js.url
        FROM jobs j
        LEFT JOIN job_sources js ON j.id = js.job_id
        WHERE js.url IS NOT NULL AND js.url != ''
        ORDER BY j.posted_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    // Group by URL
    const urlGroups = {};
    allJobs.forEach(job => {
      if (!urlGroups[job.url]) {
        urlGroups[job.url] = [];
      }
      urlGroups[job.url].push(job);
    });
    
    // Find jobs to delete (keep the most recent one for each URL)
    const jobsToDelete = new Set();
    let duplicateCount = 0;
    
    Object.values(urlGroups).forEach(group => {
      if (group.length > 1) {
        // Already sorted by posted_at DESC, so first is most recent
        // Mark all others for deletion
        for (let i = 1; i < group.length; i++) {
          jobsToDelete.add(group[i].id);
          duplicateCount++;
        }
      }
    });
    
    // Also find duplicates by normalized title+company
    const allJobsByTitle = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          id,
          LOWER(TRIM(title)) || '|' || LOWER(TRIM(company)) as normalized_key,
          title,
          company,
          posted_at
        FROM jobs
        ORDER BY posted_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    // Group by normalized key
    const titleGroups = {};
    allJobsByTitle.forEach(job => {
      const key = job.normalized_key;
      if (!titleGroups[key]) {
        titleGroups[key] = [];
      }
      titleGroups[key].push(job);
    });
    
    // Find additional duplicates by title+company
    Object.values(titleGroups).forEach(group => {
      if (group.length > 1) {
        // Already sorted by posted_at DESC, so first is most recent
        // Mark others for deletion (if not already marked)
        for (let i = 1; i < group.length; i++) {
          if (!jobsToDelete.has(group[i].id)) {
            jobsToDelete.add(group[i].id);
            duplicateCount++;
          }
        }
      }
    });
    
    console.log(`📊 Found ${duplicateCount} duplicate jobs to remove`);
    
    if (jobsToDelete.size === 0) {
      console.log('✅ No duplicates found in database');
      process.exit(0);
    }
    
    // Delete duplicates
    await new Promise((resolve, reject) => {
      db.exec('BEGIN', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    let deletedCount = 0;
    for (const jobId of jobsToDelete) {
      try {
        // Delete job sources first (foreign key constraint)
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM job_sources WHERE job_id = ?', [jobId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Delete job
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM jobs WHERE id = ?', [jobId], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        deletedCount++;
      } catch (e) {
        console.error(`Error deleting job ${jobId}:`, e.message);
      }
    }
    
    await new Promise((resolve, reject) => {
      db.exec('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log(`✅ Removed ${deletedCount} duplicate jobs from database`);
    console.log(`📊 Remaining unique jobs: ${(await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM jobs', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }))}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error removing duplicates:', error);
    process.exit(1);
  }
}

removeDuplicates();

