import { initDatabase, getDatabase } from './src/database/init.js';

async function addSampleJobs() {
  try {
    // Initialize database first
    await initDatabase();
    console.log('Database initialized');
    
    const db = getDatabase();
    
    // Sample job data
    const sampleJobs = [
      {
        id: 'sample-1',
        title: 'Senior Software Engineer',
        company: 'TechCorp',
        location: 'Sydney, NSW, Australia',
        workMode: 'Hybrid',
        category: 'Software Engineering',
        experience: 'Senior',
        salaryMin: 120000,
        salaryMax: 150000,
        descriptionSnippet: 'Join our team to build cutting-edge software solutions.',
        descriptionFull: 'We are looking for a Senior Software Engineer to join our dynamic team. You will work on exciting projects using modern technologies and contribute to our growing platform.',
        postedAt: new Date().toISOString()
      },
      {
        id: 'sample-2',
        title: 'Frontend Developer',
        company: 'WebSolutions',
        location: 'Melbourne, VIC, Australia',
        workMode: 'Remote',
        category: 'Software Engineering',
        experience: 'Mid',
        salaryMin: 90000,
        salaryMax: 110000,
        descriptionSnippet: 'Create beautiful and responsive web applications.',
        descriptionFull: 'We need a talented Frontend Developer to help us create amazing user experiences. You will work with React, TypeScript, and modern CSS frameworks.',
        postedAt: new Date().toISOString()
      },
      {
        id: 'sample-3',
        title: 'Data Scientist',
        company: 'DataCorp',
        location: 'Brisbane, QLD, Australia',
        workMode: 'On-site',
        category: 'Data',
        experience: 'Mid',
        salaryMin: 100000,
        salaryMax: 130000,
        descriptionSnippet: 'Analyze data to drive business insights and decisions.',
        descriptionFull: 'Join our data team to work on exciting machine learning projects. You will analyze large datasets and build predictive models.',
        postedAt: new Date().toISOString()
      }
    ];

    for (const job of sampleJobs) {
      // Insert job
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR REPLACE INTO jobs (
            id, title, company, location, work_mode, category, experience,
            salary_min, salary_max, description_snippet, description_full,
            posted_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          job.id,
          job.title,
          job.company,
          job.location,
          job.workMode,
          job.category,
          job.experience,
          job.salaryMin,
          job.salaryMax,
          job.descriptionSnippet,
          job.descriptionFull,
          job.postedAt,
          new Date().toISOString()
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      // Insert job source
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR REPLACE INTO job_sources (
            job_id, site, url, posted_at, external_id
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          job.id,
          'Company',
          `https://example.com/jobs/${job.id}`,
          job.postedAt,
          job.id
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      console.log(`Added job: ${job.title} at ${job.company}`);
    }

    console.log('Sample jobs added successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error adding sample jobs:', error);
    process.exit(1);
  }
}

addSampleJobs();
