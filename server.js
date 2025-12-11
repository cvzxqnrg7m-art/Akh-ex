// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const QUESTIONS_FILE = path.join(__dirname, 'questions.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Function to read questions with error handling
async function readQuestionsFile() {
    try {
        const data = await fs.readFile(QUESTIONS_FILE, 'utf8');
        if (!data.trim()) {
            // File is empty, return default structure
            return { questions: [] };
        }
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is corrupted, return default structure
        return { questions: [] };
    }
}

// Function to write questions
async function writeQuestionsFile(questionsData) {
    await fs.writeFile(QUESTIONS_FILE, JSON.stringify(questionsData, null, 2));
}

// Ensure questions.json exists on startup
async function initializeQuestionsFile() {
    try {
        await fs.access(QUESTIONS_FILE);
    } catch {
        await fs.writeFile(QUESTIONS_FILE, JSON.stringify({ questions: [] }, null, 2));
        console.log('Created questions.json file');
    }
}

// API endpoint to submit questions
app.post('/api/submit-question', async (req, res) => {
    try {
        const { name, email, question, timestamp, ip, userAgent } = req.body;
        
        // Validate required fields
        if (!question) {
            return res.status(400).json({ 
                success: false, 
                message: 'Question is required' 
            });
        }
        
        // Read existing questions
        const questionsData = await readQuestionsFile();
        
        // Add new question
        const newQuestion = {
            id: Date.now(),
            name: name || 'Anonymous',
            email: email || 'anonymous@example.com',
            question: question,
            timestamp: timestamp || new Date().toISOString(),
            ip: ip || req.ip,
            userAgent: userAgent || req.headers['user-agent'],
            status: 'pending',
            response: null,
            respondedAt: null,
            likes: 0,
            answers: []
        };
        
        questionsData.questions.push(newQuestion);
        
        // Write back to file
        await writeQuestionsFile(questionsData);
        
        res.json({
            success: true,
            message: 'Question submitted successfully',
            questionId: newQuestion.id
        });
        
    } catch (error) {
        console.error('Error submitting question:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// API endpoint to get all questions
app.get('/api/questions', async (req, res) => {
    try {
        const questionsData = await readQuestionsFile();
        res.json(questionsData.questions || []);
    } catch (error) {
        console.error('Error reading questions:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// API endpoint to update question (add answer)
app.post('/api/questions/:id/answer', async (req, res) => {
    try {
        const { id } = req.params;
        const { answer, author, isOwner } = req.body;
        
        if (!answer) {
            return res.status(400).json({ 
                success: false, 
                message: 'Answer is required' 
            });
        }
        
        const questionsData = await readQuestionsFile();
        
        const questionIndex = questionsData.questions.findIndex(q => q.id == id);
        
        if (questionIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Question not found' 
            });
        }
        
        // Add answer
        const newAnswer = {
            id: Date.now(),
            content: answer,
            author: author || 'Anonymous',
            isOwner: isOwner || false,
            date: new Date().toISOString(),
            answers: []
        };
        
        if (!questionsData.questions[questionIndex].answers) {
            questionsData.questions[questionIndex].answers = [];
        }
        
        questionsData.questions[questionIndex].answers.push(newAnswer);
        
        // Update question status if owner answered
        if (isOwner) {
            questionsData.questions[questionIndex].status = 'answered';
            questionsData.questions[questionIndex].response = answer;
            questionsData.questions[questionIndex].respondedAt = new Date().toISOString();
        }
        
        await writeQuestionsFile(questionsData);
        
        res.json({
            success: true,
            message: 'Answer added successfully'
        });
        
    } catch (error) {
        console.error('Error adding answer:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// API endpoint to like a question
app.post('/api/questions/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        
        const questionsData = await readQuestionsFile();
        
        const questionIndex = questionsData.questions.findIndex(q => q.id == id);
        
        if (questionIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Question not found' 
            });
        }
        
        // Increment likes
        if (!questionsData.questions[questionIndex].likes) {
            questionsData.questions[questionIndex].likes = 0;
        }
        questionsData.questions[questionIndex].likes++;
        
        await writeQuestionsFile(questionsData);
        
        res.json({
            success: true,
            likes: questionsData.questions[questionIndex].likes
        });
        
    } catch (error) {
        console.error('Error liking question:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Serve index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
    await initializeQuestionsFile();
    
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Questions are saved to: ${QUESTIONS_FILE}`);
    });
}

startServer();