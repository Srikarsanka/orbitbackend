const fs = require('fs');
const path = require('path');

const loadTemplate = (templateName, variables) => {
    try {
        const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
        let template = fs.readFileSync(templatePath, 'utf8');

        // Replace all variables
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, value);
        }

        return template;
    } catch (error) {
        console.error('Error loading email template:', error);
        throw error;
    }
};

/**
 * Formats a Date object into a readable string (e.g., "Friday, Feb 20, 2026")
 */
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
};

/**
 * Formats a Date object into a readable time string (e.g., "10:00 AM")
 */
const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit', 
        minute: '2-digit'
    });
};

/**
 * Formats a Date object into ISO format required for Google Calendar (YYYYMMDDTHHMMSSZ)
 */
const formatISO = (date) => {
    return new Date(date).toISOString().replace(/-|:|\.\d\d\d/g, '');
};

module.exports = {
    loadTemplate,
    formatDate,
    formatTime,
    formatISO
};
