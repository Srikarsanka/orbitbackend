const Material = require("../models/Materials");
const Class = require("../models/createclass"); // make sure this path is correct
const nodemailer = require("nodemailer");

exports.uploadMaterial = async (req, res) => {
  try {
    const { classId, title, uploadedBy, externalLink } = req.body;

    if (!req.file && !externalLink)
      return res.status(400).json({ message: "Upload file or provide link" });

    let obj = { classId, title, uploadedBy };

    // FILE UPLOAD MODE
    if (req.file) {
      obj.type = "file";
      obj.fileUrl = `/uploads/materials/${req.file.filename}`;
    }

    // LINK MODE
    if (externalLink) {
      obj.type = "link";
      obj.externalLink = externalLink;
    }

    await Material.create(obj);

    const classData = await Class.findById(classId);
    const facultyName = classData.facultyName;
    if (!classData) return res.status(404).json({ message: "Class not found" });

    // students list
    const studentEmails = classData.students.map((s) => s.studentEmail);

    // for testing also send to you
    const receiverEmails = [
      ...studentEmails,
      "sankasrikar@gmail.com",
      "mouturisatish382@gmail.com",
    ];

    if (receiverEmails.length > 0) {
      // transporter
      let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // SVG Icons as data URIs
      const classIconSVG = `data:image/svg+xml;base64,${Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>'
      ).toString("base64")}`;

      const materialIconSVG = `data:image/svg+xml;base64,${Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
      ).toString("base64")}`;

      const fileIconSVG = `data:image/svg+xml;base64,${Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>'
      ).toString("base64")}`;

      const linkIconSVG = `data:image/svg+xml;base64,${Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
      ).toString("base64")}`;

      const downloadIconSVG = `data:image/svg+xml;base64,${Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
      ).toString("base64")}`;

      // 💥 MATERIAL UPLOAD EMAIL – NEW UPDATED VERSION
      const mailOptions = {
        from: `" <${process.env.EMAIL_USER}>`,
        to: receiverEmails,
        subject: ` New Study Material Added – ${classData.className}`,
        html: `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">

  <!-- Header Banner -->
  <img src="https://res.cloudinary.com/djha4r2ys/image/upload/v1764485902/Gemini_Generated_Image_zhc2iczhc2iczhc2_kmitru.png"
   style="width: 100%; max-height: 250px; object-fit: cover; display: block;" />

  <div style="padding: 30px;">
    
    <!-- Class Badge -->
    <div style="background: #eef2ff; padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-size: 14px; color: #4338ca; font-weight: 600;">
      <img src="${classIconSVG}" style="width:16px; height:16px; margin-right:6px; vertical-align:middle;" />
      Class: ${classData.className}
    </div>

    <!-- Title -->
    <h2 style="margin: 0 0 15px 0; font-size: 24px; color: #111827;">
      New Study Material Uploaded
    </h2>

    <!-- Material Title -->
    <p style="font-size: 17px; color: #4338ca; font-weight: 600; margin: 0 0 20px 0;">
      <img src="${materialIconSVG}" style="width:18px; height:18px; margin-right:6px; vertical-align:middle;" />
      ${title}
    </p>

    <!-- Material Type Info -->
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 25px;">
      <p style="margin: 0; font-size: 15px; color: #334155;">
        ${
          req.file
            ? `<img src="${fileIconSVG}" style="width:18px; height:18px; margin-right:6px; vertical-align:middle;" /> A new file has been uploaded for your class.`
            : `<img src="${linkIconSVG}" style="width:18px; height:18px; margin-right:6px; vertical-align:middle;" /> A resource link has been added for your class.`
        }
      </p>
    </div>

    <!-- Details -->
    <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 18px 0; margin-bottom: 30px;">
      <div style="display: flex; flex-wrap: wrap; gap: 20px;">
        
        <div style="flex: 1; min-width: 150px;">
          <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
            Uploaded By
          </p>
          <p style="font-size: 16px; font-weight: 600; margin: 0; color: #111827;">
            ${facultyName}
          </p>
        </div>

        <div style="flex: 1; min-width: 150px;">
          <p style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
            Date
          </p>
          <p style="font-size: 16px; font-weight: 600; margin: 0; color: #111827;">
            ${new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>

    <!-- Button -->
    <div style="text-align: center;">
      <a href="https://orbit-zqsz.vercel.app/"
         style="background: #4338ca; color: white; padding: 14px 35px; border-radius: 8px; display: inline-block; text-decoration: none; font-size: 15px; font-weight: 600;">
        <img src="${downloadIconSVG}" style="width:18px; height:18px; margin-right:6px; vertical-align:middle;" />
        View / Download Material
      </a>
    </div>
  </div>

  <!-- Footer -->
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">
      This is an automated notification from Orbit Classroom
    </p>
    <p style="font-size: 14px; color: #4338ca; font-weight: 700; margin: 0;">
      ORBIT • LEARN • GROW
    </p>
  </div>
</div>
`,
      };

      await transporter.sendMail(mailOptions);
    }

    res.status(200).json({ message: "Material uploaded successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
};

exports.getMaterials = async (req, res) => {
  try {
    const { classId } = req.params;
    const materials = await Material.find({ classId }).sort({ createdAt: -1 });
    res.status(200).json({ materials });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id);

    if (!material)
      return res.status(404).json({ message: "Material not found" });

    if (material.fileUrl) {
      const fs = require("fs");
      fs.unlink("." + material.fileUrl, () => {});
    }

    await Material.findByIdAndDelete(id);
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
