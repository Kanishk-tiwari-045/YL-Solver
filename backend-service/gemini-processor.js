const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const cheerio = require('cheerio');
const { YoutubeTranscript } = require('youtube-transcript');
const puppeteer = require('puppeteer');

class GeminiProcessor {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash"
    });
  }

  async processProblem(url) {
    let content = '';
    let problemType = '';

    if (url.includes('youtube.com')) {
      content = await this.extractYouTubeContent(url);
      problemType = 'YouTube Video';
    } else if (url.includes('leetcode.com')) {
      content = await this.extractLeetCodeContentWithPuppeteer(url);
      problemType = 'LeetCode Problem';
    }

    return await this.generateSolution(content, problemType, url);
  }

  async extractYouTubeContent(url) {
    try {
      const videoId = this.extractVideoId(url);
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      return transcript.map(item => item.text).join(' ');
    } catch (error) {
      console.error('Error extracting YouTube content:', error);
      return 'Unable to extract video content';
    }
  }

  async extractLeetCodeContentWithPuppeteer(url) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      const page = await browser.newPage();
      
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });
      
      console.log(`Navigating to: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      await page.waitForTimeout(3000);

      const content = await this.tryMultipleLeetCodeSelectors(page);

      await browser.close();
      
      if (content.title || content.description) {
        return `Problem: ${content.title}\n\nDescription: ${content.description}`;
      } else {
        throw new Error('Could not extract problem content');
      }

    } catch (error) {
      if (browser) {
        await browser.close();
      }
      console.error('Error extracting LeetCode content with Puppeteer:', error);
      return this.getFallbackLeetCodeContent(url);
    }
  }

  async tryMultipleLeetCodeSelectors(page) {
    // Strategy 1: Try modern LeetCode selectors
    try {
      console.log('Trying strategy 1: Modern selectors');
      await page.waitForSelector('h1, [data-cy="question-title"]', { timeout: 5000 });
      
      const content = await page.evaluate(() => {
        const titleSelectors = [
          'h1[class*="title"]',
          '[data-cy="question-title"]',
          '.css-10o4wqw',
          'h1',
          '.question-title',
          '[class*="question-title"]'
        ];
        
        let title = '';
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            title = element.textContent.trim();
            break;
          }
        }

        const descriptionSelectors = [
          '[class*="description"]',
          '[data-track-load="description_content"]',
          '.content__u3I1',
          '.question-content',
          '.css-1jqueqk',
          '[class*="content"]',
          '.elfjS',
          '.notranslate'
        ];
        
        let description = '';
        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            description = element.textContent.trim();
            break;
          }
        }

        return { title, description };
      });

      if (content.title || content.description) {
        console.log('Strategy 1 successful');
        return content;
      }
    } catch (error) {
      console.log('Strategy 1 failed:', error.message);
    }

    // Strategy 2: Wait longer and try different approach
    try {
      console.log('Trying strategy 2: Wait and retry');
      await page.waitForTimeout(5000);
      
      const content = await page.evaluate(() => {
        const allText = document.body.textContent || '';
        const lines = allText.split('\n').filter(line => line.trim().length > 0);
        
        let title = '';
        let description = '';
        
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          const line = lines[i].trim();
          if (line.length > 5 && line.length < 100 && !line.includes('LeetCode') && !line.includes('Sign in')) {
            title = line;
            break;
          }
        }
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.length > 50 && (line.includes('Given') || line.includes('Return') || line.includes('Find'))) {
            description = lines.slice(i, i + 10).join(' ').substring(0, 1000);
            break;
          }
        }
        
        return { title, description };
      });

      if (content.title || content.description) {
        console.log('Strategy 2 successful');
        return content;
      }
    } catch (error) {
      console.log('Strategy 2 failed:', error.message);
    }

    // Strategy 3: Full page text extraction
    try {
      console.log('Trying strategy 3: Full page text extraction');
      
      const content = await page.evaluate(() => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              
              const style = window.getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden') {
                return NodeFilter.FILTER_REJECT;
              }
              
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        let textContent = '';
        let node;
        while (node = walker.nextNode()) {
          textContent += node.textContent + ' ';
        }

        const text = textContent.replace(/\s+/g, ' ').trim();
        const words = text.split(' ');
        
        let title = words.slice(0, 10).join(' ');
        let description = text.substring(0, 500);
        
        return { title, description };
      });

      console.log('Strategy 3 completed');
      return content;
      
    } catch (error) {
      console.log('Strategy 3 failed:', error.message);
      return { title: '', description: '' };
    }
  }

  getFallbackLeetCodeContent(url) {
    const match = url.match(/\/problems\/([^\/]+)/);
    const problemName = match ? match[1].replace(/-/g, ' ') : 'Unknown Problem';
    
    return `Problem: ${problemName}
    
This appears to be a LeetCode problem. The automated extraction encountered issues, but I can still provide a comprehensive solution analysis.

Please provide a solution that includes:
1. Problem analysis and understanding
2. Multiple approaches (brute force, optimized, optimal)
3. Time and space complexity for each approach
4. Complete code implementations in C++
5. Step-by-step explanations with detailed walkthroughs

Problem URL: ${url}
    `;
  }

  async generateSolution(content, problemType, sourceUrl) {
    const prompt = `
    You are an expert competitive programming instructor specializing in C++ solutions. Analyze the following ${problemType} content and provide a comprehensive coding solution with detailed explanations.

    Content: ${content}

    IMPORTANT: You must provide ONLY C++ code implementations. Do not generate Python or JavaScript code.

    Please provide a thorough analysis with:
    1. **Problem Statement**: Clear and detailed problem description
    2. **Problem Analysis**: Break down the problem requirements, constraints, and edge cases
    3. **Three Solution Approaches** with progressive optimization:
       - **Brute Force Approach**: Straightforward solution, easy to understand
       - **Better/Optimized Approach**: Improved efficiency with better data structures or algorithms
       - **Optimal Approach**: Most efficient solution with best time/space complexity
    
    For each approach, provide:
    - **Intuition**: Why this approach works and the key insight
    - **Algorithm Explanation**: Step-by-step breakdown of the logic
    - **Time Complexity**: Big O notation with detailed reasoning
    - **Space Complexity**: Big O notation with detailed reasoning
    - **Complete C++ Implementation**: Production-ready C++ code with proper headers, comments, and error handling
    - **Detailed Step-by-Step Walkthrough**: Trace through the algorithm with a concrete example, showing each iteration/step
    - **Edge Cases**: Important edge cases to consider
    - **Optimization Notes**: Why this approach is better than the previous one

    **C++ Code Requirements:**
    - Use modern C++ (C++17 or later) features where appropriate
    - Include proper #include statements
    - Use appropriate STL containers and algorithms
    - Add comprehensive comments explaining complex logic
    - Include proper input/output handling
    - Use meaningful variable names
    - Follow C++ best practices and coding standards

    Format your response as a structured JSON with this exact schema:
    {
      "problemStatement": "Detailed problem description with constraints",
      "problemAnalysis": "Breakdown of requirements, constraints, and key insights",
      "sourceUrl": "${sourceUrl}",
      "approaches": [
        {
          "name": "Brute Force",
          "intuition": "Core insight and why this approach works",
          "explanation": "Detailed algorithm explanation with step-by-step logic",
          "timeComplexity": "O(n) notation with detailed reasoning and analysis",
          "spaceComplexity": "O(n) notation with detailed reasoning and analysis",
          "cppCode": "Complete, production-ready C++ code with headers, comments, and proper structure. Must include #include statements, using namespace std or explicit std:: usage, main function for testing, and comprehensive comments.",
          "walkthrough": "Detailed step-by-step trace through the algorithm with concrete example, showing each iteration",
          "edgeCases": "Important edge cases and how the algorithm handles them",
          "optimizationNotes": "Areas for improvement and why we need a better approach"
        },
        {
          "name": "Better Approach", 
          "intuition": "Key insight that improves upon brute force",
          "explanation": "Detailed algorithm explanation showing the optimization",
          "timeComplexity": "O(n) notation with detailed reasoning and comparison to brute force",
          "spaceComplexity": "O(n) notation with detailed reasoning and comparison to brute force",
          "cppCode": "Complete, optimized C++ code with modern features and comprehensive comments. Must include all necessary headers and be fully compilable.",
          "walkthrough": "Detailed step-by-step trace showing how the optimization works with examples",
          "edgeCases": "Edge cases and improved handling compared to brute force",
          "optimizationNotes": "What makes this better and potential for further optimization"
        },
        {
          "name": "Optimal Approach",
          "intuition": "Most efficient insight and advanced technique used",
          "explanation": "Detailed explanation of the most efficient algorithm with advanced concepts",
          "timeComplexity": "O(n) notation with detailed reasoning and proof of optimality",
          "spaceComplexity": "O(n) notation with detailed reasoning and space optimization techniques",
          "cppCode": "Highly optimized C++ code using advanced techniques, STL, and modern C++ features. Must be complete and compilable with all necessary includes.",
          "walkthrough": "Comprehensive step-by-step trace showing advanced optimization in action",
          "edgeCases": "All edge cases and robust handling in the optimal solution",
          "optimizationNotes": "Why this is optimal and any trade-offs made"
        }
      ],
      "keyInsights": "Most important algorithmic insights and patterns learned",
      "relatedTopics": ["Advanced data structures", "Algorithm patterns", "Optimization techniques"],
      "testCases": [
        {
          "input": "Sample input",
          "output": "Expected output",
          "explanation": "Why this output is correct"
        }
      ],
      "practiceProblems": ["Similar problems to practice these concepts"]
    }

    CRITICAL: Each cppCode field must contain complete, compilable C++ code that includes:
    - All necessary #include statements (like #include <iostream>, #include <vector>, etc.)
    - Proper namespace usage (using namespace std; or explicit std::)
    - Complete main() function with input/output handling
    - All helper functions if needed
    - Comprehensive comments explaining the logic
    - Modern C++ best practices

    Example of proper C++ code format:
    #include <iostream>
    #include <vector>
    #include <unordered_map>
    using namespace std;
    
    class Solution {
    public:
        vector<int> twoSum(vector<int>& nums, int target) {
            // Implementation here
        }
    };
    
    int main() {
        // Test code here
        return 0;
    }
    `;

    try {
      const result = await this.model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2, // Lower temperature for more consistent code generation
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });

      const responseText = result.response.text();
      
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Unable to parse Gemini response');
      
    } catch (error) {
      console.error('Error generating solution:', error);
      throw error;
    }
  }

  extractVideoId(url) {
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }
}

module.exports = GeminiProcessor;
