const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Import your existing modules
const GeminiProcessor = require('./backend-service/gemini-processor');
const EmailService = require('./backend-service/email-service');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const geminiProcessor = new GeminiProcessor(process.env.GEMINI_API_KEY);
const emailService = new EmailService();

// Load HTML template
const templatePath = path.join(__dirname, 'doc-generator', 'templates', 'solution-template.html');
const templateSource = fs.readFileSync(templatePath, 'utf8');
const template = handlebars.compile(templateSource);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'YouTube LeetCode Automation',
    timestamp: new Date().toISOString() 
  });
});

app.post('/api/process', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Processing URL: ${url}`);
    
    // Start processing asynchronously
    processUrlAsync(url);
    
    res.json({ 
      message: 'Processing started', 
      estimatedTime: '5 minutes' 
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processUrlAsync(url) {
  try {
    console.log('Step 1: Starting Gemini processing...');
    const solution = await geminiProcessor.processProblem(url);
    console.log('Step 1: Gemini processing completed');
    
    console.log('Step 2: Generating document...');
    const pdfResult = await generatePDF(solution);
    console.log('Step 2: Document generated');
    
    console.log('Step 3: Sending email...');
    const problemTitle = solution.problemStatement || 'Coding Problem Solution';
    
    await emailService.sendSolutionEmail(
      process.env.USER_EMAIL,
      pdfResult.filepath,
      problemTitle
    );
    
    console.log('Step 3: Email sent successfully!');
    
    // Clean up PDF
    setTimeout(() => {
      try {
        if (fs.existsSync(pdfResult.filepath)) {
          fs.unlinkSync(pdfResult.filepath);
          console.log('PDF cleaned up');
        }
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, 60000);
    
  } catch (error) {
    console.error('Processing error:', error);
  }
}

async function generatePDF(solutionData) {
  solutionData.currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const htmlContent = template(solutionData);
  
  const browser = await puppeteer.launch({ 
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  
  await browser.close();
  
  const filename = `solution_${Date.now()}.pdf`;
  const filepath = path.join(__dirname, 'temp', filename);
  
  // Create temp directory
  if (!fs.existsSync(path.dirname(filepath))) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  }
  
  fs.writeFileSync(filepath, pdfBuffer);
  
  return { filename, filepath };
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
