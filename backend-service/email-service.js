const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({  // Fixed: removed "er"
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendSolutionEmail(recipient, pdfPath, problemTitle) {
    try {
      console.log('Preparing to send email...');
      console.log('PDF Path:', pdfPath);
      console.log('Problem Title:', problemTitle);

      // Check if PDF file exists
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
      }

      const mailOptions = {
        from: {
          name: 'YouTube LeetCode Solver',
          address: process.env.EMAIL_USER
        },
        to: recipient,
        subject: `C++ Solution: ${problemTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007acc;">Your C++ Coding Solution is Ready! 🚀</h2>
            
            <p>Hi there!</p>
            
            <p>Your requested coding solution for <strong>"${problemTitle}"</strong> has been processed and is attached as a comprehensive PDF document.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #007acc; margin-top: 0;">📋 What's Included:</h3>
              <ul style="line-height: 1.6;">
                <li><strong>Problem Analysis</strong> - Detailed breakdown of requirements</li>
                <li><strong>Three Solution Approaches:</strong>
                  <ul>
                    <li>🔴 Brute Force - Easy to understand approach</li>
                    <li>🟡 Better Approach - Optimized solution</li>
                    <li>🟢 Optimal Approach - Most efficient solution</li>
                  </ul>
                </li>
                <li><strong>Complete C++ Code</strong> - Production-ready implementations</li>
                <li><strong>Time & Space Complexity</strong> - Detailed analysis for each approach</li>
                <li><strong>Step-by-Step Walkthroughs</strong> - Algorithm traces with examples</li>
                <li><strong>Edge Cases</strong> - Important boundary conditions</li>
                <li><strong>Optimization Notes</strong> - Why each approach is better</li>
              </ul>
            </div>
            
            <p style="background: #e8f4fd; padding: 15px; border-radius: 5px; border-left: 4px solid #007acc;">
              💡 <strong>Pro Tip:</strong> Study all three approaches to understand the progression from basic to optimal solutions!
            </p>
            
            <p>Happy coding and best of luck with your interview preparation! 💪</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="color: #666; font-size: 14px;">
              <em>YouTube LeetCode Solver - Automated Coding Solution Generator</em><br>
              Generated on: ${new Date().toLocaleString()}
            </p>
          </div>
        `,
        attachments: [
          {
            filename: `${problemTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Solution.pdf`,
            path: pdfPath,
            contentType: 'application/pdf'
          }
        ]
      };

      console.log('Sending email...');
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        message: 'Email sent successfully'
      };

    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = EmailService;
