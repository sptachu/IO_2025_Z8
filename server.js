// server.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const app = express();

app.get('/process-image', (req, res) => {
    // 1. Point to the image file we want Python to read
    // We use path.join to ensure it works on both Windows and Mac/Linux
    const imagePath = path.join(__dirname, 'test.jpg');
    
    // 2. Spawn Python
    const pythonProcess = spawn('python', ['./image_script.py', imagePath]);

    let resultString = '';

    // 3. Listen for data
    pythonProcess.stdout.on('data', (data) => {
        resultString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data}`);
    });

    // 4. Send response
    pythonProcess.on('close', (code) => {
        try {
            const jsonResult = JSON.parse(resultString);
            
            // If Python sent back an error object (like "File not found")
            if (jsonResult.error) {
                return res.status(400).json(jsonResult);
            }

            res.json(jsonResult);
        } catch (e) {
            console.error("Parse Error:", e);
            res.status(500).send("Error parsing Python response");
        }
    });
});

app.listen(3000, () => console.log('Server running on port 3000'));