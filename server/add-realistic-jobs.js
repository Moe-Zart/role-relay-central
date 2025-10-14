import { initDatabase, getDatabase } from './src/database/init.js';

async function addRealisticJobData() {
  try {
    await initDatabase();
    console.log('Database initialized');
    
    const db = getDatabase();
    
    // More realistic job data that mimics real scraping results
    const realisticJobs = [
      {
        id: 'indeed-react-dev-001',
        title: 'React Developer',
        company: 'TechStart Pty Ltd',
        location: 'Sydney, NSW, Australia',
        workMode: 'Hybrid',
        category: 'Software Engineering',
        experience: 'Mid',
        salaryMin: 95000,
        salaryMax: 120000,
        descriptionSnippet: 'Join our growing team to build modern web applications using React, TypeScript, and Node.js.',
        descriptionFull: 'We are looking for a talented React Developer to join our dynamic team. You will work on exciting projects using modern technologies including React, TypeScript, Node.js, and AWS. This role offers excellent growth opportunities and the chance to work with cutting-edge technologies.',
        postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        sources: [{
          site: 'Indeed',
          url: 'https://au.indeed.com/viewjob?jk=ABC123',
          postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          externalId: 'ABC123'
        }]
      },
      {
        id: 'seek-data-scientist-001',
        title: 'Senior Data Scientist',
        company: 'DataCorp Australia',
        location: 'Melbourne, VIC, Australia',
        workMode: 'Remote',
        category: 'Data',
        experience: 'Senior',
        salaryMin: 130000,
        salaryMax: 160000,
        descriptionSnippet: 'Lead data science initiatives and build machine learning models for our enterprise clients.',
        descriptionFull: 'We are seeking a Senior Data Scientist to lead our data science initiatives. You will work with large datasets, build machine learning models, and provide insights to drive business decisions. Experience with Python, R, SQL, and cloud platforms required.',
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        sources: [{
          site: 'Seek',
          url: 'https://www.seek.com.au/job/456789',
          postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          externalId: '456789'
        }]
      },
      {
        id: 'linkedin-fullstack-001',
        title: 'Full Stack Developer',
        company: 'Innovation Labs',
        location: 'Brisbane, QLD, Australia',
        workMode: 'On-site',
        category: 'Software Engineering',
        experience: 'Mid',
        salaryMin: 85000,
        salaryMax: 110000,
        descriptionSnippet: 'Develop end-to-end solutions using modern web technologies and cloud platforms.',
        descriptionFull: 'Join our innovative team as a Full Stack Developer. You will work on exciting projects using React, Node.js, Python, and AWS. We offer a collaborative environment, professional development opportunities, and competitive benefits.',
        postedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        sources: [{
          site: 'LinkedIn',
          url: 'https://www.linkedin.com/jobs/view/789012',
          postedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          externalId: '789012'
        }]
      },
      {
        id: 'glassdoor-devops-001',
        title: 'DevOps Engineer',
        company: 'Cloud Solutions Inc',
        location: 'Perth, WA, Australia',
        workMode: 'Hybrid',
        category: 'Software Engineering',
        experience: 'Senior',
        salaryMin: 120000,
        salaryMax: 150000,
        descriptionSnippet: 'Manage cloud infrastructure and implement CI/CD pipelines for our development teams.',
        descriptionFull: 'We are looking for an experienced DevOps Engineer to join our team. You will be responsible for managing our cloud infrastructure, implementing CI/CD pipelines, and ensuring high availability of our systems. Experience with AWS, Docker, Kubernetes, and Terraform required.',
        postedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        sources: [{
          site: 'Glassdoor',
          url: 'https://www.glassdoor.com.au/job-listing/345678',
          postedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          externalId: '345678'
        }]
      },
      {
        id: 'indeed-ui-designer-001',
        title: 'UI/UX Designer',
        company: 'Creative Agency Co',
        location: 'Adelaide, SA, Australia',
        workMode: 'Remote',
        category: 'Design',
        experience: 'Mid',
        salaryMin: 75000,
        salaryMax: 95000,
        descriptionSnippet: 'Create beautiful and intuitive user interfaces for web and mobile applications.',
        descriptionFull: 'Join our creative team as a UI/UX Designer. You will work on exciting projects creating beautiful and intuitive user interfaces for web and mobile applications. Experience with Figma, Sketch, Adobe Creative Suite, and user research methodologies required.',
        postedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        sources: [{
          site: 'Indeed',
          url: 'https://au.indeed.com/viewjob?jk=DEF456',
          postedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          externalId: 'DEF456'
        }]
      }
    ];

    for (const job of realisticJobs) {
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

      // Insert job sources
      for (const source of job.sources) {
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT OR REPLACE INTO job_sources (
              job_id, site, url, posted_at, external_id
            ) VALUES (?, ?, ?, ?, ?)
          `, [
            job.id,
            source.site,
            source.url,
            source.postedAt,
            source.externalId
          ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
      }

      console.log(`Added job: ${job.title} at ${job.company} (${job.sources[0].site})`);
    }

    console.log(`\nSuccessfully added ${realisticJobs.length} realistic jobs!`);
    console.log('These jobs represent what you would get from real scraping.');
    console.log('Refresh your frontend to see the new job listings.');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error adding realistic jobs:', error);
    process.exit(1);
  }
}

addRealisticJobData();
