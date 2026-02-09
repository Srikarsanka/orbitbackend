const ClassSession = require('../models/ClassSession');

/**
 * Get aggregated analytics for faculty dashboard
 * @route GET /api/analytics
 */
exports.getAnalyticsOverview = async (req, res) => {
  try {
    const { facultyEmail } = req.query;

    if (!facultyEmail) {
      return res.status(400).json({ error: 'Faculty email is required' });
    }

    // 1. Fetch all completed sessions for this faculty
    console.log(`Analytics Request for: ${facultyEmail}`);
    const sessions = await ClassSession.find({
      facultyEmail: facultyEmail,
      status: { $in: ['ENDED', 'COMPLETED'] } // Assuming 'ENDED' is the status for finished sessions
    }).sort({ actualStartTime: 1 });

    console.log(`Found ${sessions.length} sessions for analytics.`);

    // 2. Calculate Overview Stats
    const totalSessions = sessions.length;
    
    let totalMinutes = 0;
    let totalAttendanceSum = 0;
    let totalStudentsConfigured = 0;

    // 3. Prepare Data for Charts
    const attendanceDistribution = {
      low: 0,    // < 50%
      medium: 0, // 50-80%
      high: 0    // > 80%
    };

    const timelineData = [];

    sessions.forEach(session => {
      // Overview stats accumulation
      const duration = session.duration || 0; // minutes
      totalMinutes += duration;
      
      let attendance = session.averageAttendancePercentage;
      if (attendance === undefined || attendance === null) {
        attendance = session.totalEnrolledStudents > 0 
          ? Math.round((session.attendanceCount / session.totalEnrolledStudents) * 100)
          : 0;
      }
      totalAttendanceSum += attendance;

      // Distribution for Donut Chart
      if (attendance < 50) {
        attendanceDistribution.low++;
      } else if (attendance < 80) {
        attendanceDistribution.medium++;
      } else {
        attendanceDistribution.high++;
      }

      // Timeline Data for Mountain Graph
      if (session.actualStartTime) {
        timelineData.push({
          date: session.actualStartTime,
          attendance: attendance,
          className: session.classCode, // or classTitle
          totalStudents: session.totalEnrolledStudents || 0,
          presentStudents: session.attendanceCount || 0,
          sessionId: session._id
        });
      }
    });

    const totalHours = Math.round(totalMinutes / 60);
    const avgAttendance = totalSessions > 0 ? Math.round(totalAttendanceSum / totalSessions) : 0;

    // 4. Return Data
    res.json({
      overview: {
        totalSessions,
        totalHours,
        avgAttendance,
      },
      charts: {
        attendanceDistribution: [
           attendanceDistribution.low,
           attendanceDistribution.medium,
           attendanceDistribution.high
        ],
        // Group by month or week if needed, but for now sending raw points for frontend to handle or simple aggregation
        timeline: timelineData
      }
    });

  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
};

/**
 * Get detailed analytics for a specific session
 * @route GET /api/analytics/session/:sessionId
 */
exports.getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await ClassSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Calculate attendance percentage if missing
    let attendancePercentage = session.averageAttendancePercentage;
    if (attendancePercentage === undefined || attendancePercentage === null) {
      attendancePercentage = session.totalEnrolledStudents > 0 
        ? Math.round((session.attendanceCount / session.totalEnrolledStudents) * 100)
        : 0;
    }

    // Prepare response
    const data = {
      ...session.toObject(),
      averageAttendancePercentage: attendancePercentage,
      participants: session.participants ? session.participants.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt)) : []
    };

    res.json(data);

  } catch (error) {
    console.error('Session Details Error:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
};
