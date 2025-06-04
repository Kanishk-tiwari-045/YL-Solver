const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const GeminiProcessor = require('./gemini-processor');
const EmailService = require('./email-service');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const geminiProcessor = new GeminiProcessor(process.env.GEMINI_API_KEY);
const emailService = new EmailService();

// Test email connection on startup
emailService.testConnection();

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
    const docResponse = await fetch('http://localhost:3001/api/generate-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solution)
    });
    
    const docResult = await docResponse.json();
    console.log('Step 2: Document generated:', docResult.filename);
    
    // Get the local file path
    const pdfPath = path.join(__dirname, '..', 'doc-generator', 'generated', docResult.filename);
    
    console.log('Step 3: Sending email with attachment...');
    
    // Extract problem title from solution
    const problemTitle = solution.problemStatement || 'Coding Problem Solution';
    
    // Send email with PDF attachment
    const emailResult = await emailService.sendSolutionEmail(
      process.env.USER_EMAIL,
      pdfPath,
      problemTitle
    );
    
    console.log('Step 3: Email sent successfully!', emailResult.messageId);
    
    // Optional: Clean up the PDF file after sending
    setTimeout(() => {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log('PDF file cleaned up:', docResult.filename);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up PDF:', cleanupError);
      }
    }, 60000); // Delete after 1 minute
    
  } catch (error) {
    console.error('Async processing error:', error);
  }
}

app.listen(PORT, () => {
  console.log(`Backend service running on port ${PORT}`);
});
