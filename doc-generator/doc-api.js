const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Load HTML template
const templatePath = path.join(__dirname, 'templates', 'solution-template.html');
const templateSource = fs.readFileSync(templatePath, 'utf8');
const template = handlebars.compile(templateSource);

app.post('/api/generate-doc', async (req, res) => {
  try {
    const solutionData = req.body;
    
    // Add current date to the template data
    solutionData.currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Generate HTML content
    const htmlContent = template(solutionData);
    
    // Generate PDF using Puppeteer
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
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });
    
    await browser.close();
    
    // Save PDF file
    const filename = `solution_${Date.now()}.pdf`;
    const filepath = path.join(__dirname, 'generated', filename);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(path.dirname(filepath))) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
    }
    
    fs.writeFileSync(filepath, pdfBuffer);
    
    console.log(`PDF generated successfully: ${filename}`);
    
    res.json({
      success: true,
      filename: filename,
      filepath: filepath,
      size: pdfBuffer.length
    });
    
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Document Generator API' });
});

app.listen(PORT, () => {
  console.log(`Document generator API running on port ${PORT}`);
});
