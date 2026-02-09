const express = require('express');
const router = express.Router();

// Mock Data moved from Frontend (Expanded with AI/Quantum topics and Highlights)
const ALL_NEWS = [
    // AI & Tech
    {
        id: 'ai_future',
        title: 'The Future of AI in Education',
        link: 'https://www.weforum.org/agenda/2024/01/ai-education-benefits-challenges/',
        source: 'World Economic Forum',
        pubDate: '2024-01-15',
        description: 'How artificial intelligence is reshaping personalized learning and classroom dynamics.',
        thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
        tags: ['ai', 'tech', 'future'],
        highlights: [
            "AI enables personalized learning paths for individual student needs.",
            "Teachers can focus more on mentorship as AI handles administrative tasks.",
            "Challenges include data privacy and ensuring equitable access to tech."
        ],
        content: `
            <p>Artificial Intelligence (AI) is rapidly transforming the educational landscape, offering new opportunities for personalized learning and administrative efficiency. From intelligent tutoring systems to automated grading, AI tools are helping educators tailor instruction to individual student needs.</p>
            <p>One of the most significant benefits is the ability to analyze vast amounts of data to identify learning gaps. "AI doesn't replace teachers; it augments them," says Dr. Sarah Johnson, an EdTech researcher. "It handles the repetitive tasks, allowing teachers to focus on mentorship and critical thinking."</p>
            <p>However, the integration of AI also brings challenges, including data privacy concerns and the digital divide. Schools must ensure that these technologies are implemented equitably so that all students can benefit from the personalized support that AI offers.</p>
        `
    },
    {
        id: 'ai_tools_2025',
        title: 'Top 5 AI Tools Changing EdTech in 2025',
        link: 'https://techcrunch.com/category/education/',
        source: 'TechCrunch EdTech',
        pubDate: '2024-02-06',
        description: 'From personalized tutors to automated grading, how AI is revolutionizing the classroom.',
        thumbnail: 'https://images.unsplash.com/photo-1501504905252-473cdf7efbab?auto=format&fit=crop&q=80&w=800',
        tags: ['ai', 'edtech', 'tools'],
        highlights: [
            "CogniLearn uses visualization to solve student confusion in math.",
            "WriteRight focuses on the logic and structure of writing using AI.",
            "LabSim AI allows for unlimited virtual experiments in a safe environment."
        ],
        content: `
            <p>As we move further into 2025, several AI-powered tools are standing out in the EdTech sector. These platforms go beyond simple quizzes, offering adaptive learning paths that adjust in real-time to a student's performance.</p>
            <p><strong>1. CogniLearn:</strong> A adaptive math tutor that visualizes concepts based on student confusion.<br>
            <strong>2. WriteRight:</strong> An AI writing assistant that focuses on logic and structure rather than just grammar.<br>
            <strong>3. LabSim AI:</strong> Virtual science labs where students can run unlimited experiments safely.</p>
            <p>These tools are making high-quality education more accessible and engaging, proving that the future of learning is interactive and personalized.</p>
        `
    },
    {
        id: 'harvard_cs50',
        title: 'Harvard University Launches Free CS50 AI Course',
        link: 'https://pll.harvard.edu/course/cs50-introduction-artificial-intelligence-python',
        source: 'Harvard Gazette',
        pubDate: '2024-02-05',
        description: 'New self-paced course covers machine learning, neural networks, and LLMs for beginners.',
        thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e51afb?auto=format&fit=crop&q=80&w=800',
        tags: ['ai', 'course', 'cs'],
        highlights: [
            "Harvard expands its CS50 series with a specialized AI track.",
            "Course covers graph search, reinforcement learning, and neural networks.",
            "Includes hands-on projects to build real-world AI models."
        ],
        content: `
            <p>Harvard University's famous CS50 introduction to computer science has expanded with a specialized track for Artificial Intelligence. The new course, CS50 AI, is available for free online and covers the fundamental concepts of modern AI.</p>
            <p>Students will dive into graph search algorithms, reinforcement learning, machine learning, and neural networks. "We want to demystify AI," says Professor David Malan. "It's not magic; it's math and code."</p>
            <p>The course includes hands-on projects where students build their own AI models, making it an excellent starting point for anyone looking to enter the field of computer science.</p>
        `
    },
    
    // Quantum Computing
    {
        id: 'quantum_leap',
        title: 'Quantum Computing: A Leap for Science',
        link: 'https://www.nature.com/articles/d41586-023-03267-0',
        source: 'Nature',
        pubDate: '2024-01-20',
        description: 'Scientists achieve new stability record in qubit coherence, paving the way for fault-tolerant quantum computers.',
        thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=800',
        tags: ['quantum', 'science', 'research'],
        highlights: [
            "Stability record achieved in qubit coherence (10x improvement).",
            "Crucial milestone for fault-tolerant quantum computing systems.",
            "Implications for drug discovery and complex material science."
        ],
        content: `
            <p>A major breakthrough in quantum computing has been reported in <em>Nature</em> today. Researchers have achieved a new record in "qubit coherence," effectively keeping quantum bits stable for 10 times longer than previously possible.</p>
            <p>This stability is crucial for building fault-tolerant quantum computers that can solve complex problems in drug discovery, material science, and cryptography. "We are moving from the era of noisy quantum experiments to practical, error-corrected utility," says lead researcher Dr. Elena Rossi.</p>
            <p>While a personal quantum computer is still decades away, this milestone brings us significantly closer to solving problems that are currently impossible for classical supercomputers.</p>
        `
    },
    {
        id: 'ibm_quantum',
        title: 'IBM Unveils New Quantum Processor',
        link: 'https://research.ibm.com/blog/quantum-roadmap-2033',
        source: 'IBM Research',
        pubDate: '2024-02-01',
        description: 'The new Heron processor brings us closer to utility-scale quantum computing.',
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800',
        tags: ['quantum', 'tech', 'ibm', 'ai'],
        highlights: [
            "IBM launches 'Heron' processor featuring 133 qubits.",
            "New software stack treats quantum chips like standard cloud resources.",
            "Potential to orders-of-magnitude acceleration for AI training."
        ],
        content: `
            <p>IBM has unveiled its latest quantum processor, 'Heron', which features 133 qubits with tunable couplers to reduce cross-talk and errors. This chip represents a significant step forward in the company's quantum roadmap.</p>
            <p>Alongside the hardware, IBM released a new software stack designed to let developers treat quantum processors like standard cloud resources. "Quantum utility is here," claims IBM's Director of Research.</p>
            <p>The integration of quantum computing with AI workloads is the next major frontier, potentially accelerating machine learning training times by orders of magnitude.</p>
        `
    },

    // Exams & General Education
    {
        id: 'cbse_2025',
        title: 'CBSE Board Exam 2025: Date Sheet Released',
        link: 'https://www.cbse.gov.in/',
        source: 'Education Times',
        pubDate: '2024-02-08',
        description: 'Class 10 and 12 board exams to commence from Feb 15. Check complete schedule and guidelines.',
        thumbnail: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=800',
        tags: ['exam', 'education', 'cbse'],
        highlights: [
            "Exams for Class 10 and 12 to start from Feb 15, 2025.",
            "Schedule provides adequate gap days between major subjects.",
            "Practical exams to be finalized by the end of January."
        ],
        content: `
            <p>The Central Board of Secondary Education (CBSE) has officially released the date sheet for the 2025 Class 10 and 12 board examinations. The exams are scheduled to commence on February 15, 2025.</p>
            <p><strong>Key Highlights:</strong><br>
            - Exams will begin at 10:30 AM IST.<br>
            - Adequate gap days have been provided between major subjects.<br>
            - Practical exams will be completed by January 31st.</p>
            <p>Students are advised to download the full schedule from the official website and plan their revision accordingly. Teachers recommend focusing on NCERT textbooks and solving previous year's question papers.</p>
        `
    }
];

// GET /api/news
// Query Params: ?topics=ai,quantum
router.get('/', (req, res) => {
    try {
        const { topics } = req.query;
        let filteredNews = ALL_NEWS;

        // Backend Filter Logic
        if (topics) {
            const topicList = topics.split(',').map(t => t.trim().toLowerCase());
            filteredNews = ALL_NEWS.filter(item => {
                const matchesTag = item.tags.some(tag => topicList.includes(tag));
                const matchesText = topicList.some(topic => 
                    item.title.toLowerCase().includes(topic) || 
                    item.description.toLowerCase().includes(topic)
                );
                return matchesTag || matchesText;
            });
        }

        res.status(200).json({
            success: true,
            count: filteredNews.length,
            articles: filteredNews
        });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
