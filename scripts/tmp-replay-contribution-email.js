require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getFormsCollection, closeMongoConnection } = require('../api/_config_shared/mongodb');
const { sendAlertEmail, ALERT_EMAIL } = require('../api/_utils_shared/mailer');
const { getContributionNotificationTemplate } = require('../api/_utils_shared/email-templates');

(async () => {
  try {
    const collection = await getFormsCollection();
    const doc = await collection
      .find({ formType: 'contribution' })
      .sort({ submittedAt: -1 })
      .limit(1)
      .next();

    if (!doc) {
      console.log(JSON.stringify({ success: false, reason: 'No contribution submission found' }));
      await closeMongoConnection();
      process.exit(1);
    }

    const cid = doc.contributionCid ? String(doc.contributionCid) : `SUB-${String(doc._id)}`;
    const submittedAt = doc.submittedAt ? new Date(doc.submittedAt) : new Date();
    const contributor = doc?.user?.displayName || doc?.user?.username || doc?.user?.githubUsername || 'Anonymous';
    const semester = doc?.data?.semester || 'N/A';
    const subject = doc?.data?.subject || 'N/A';
    const category = doc?.data?.category || 'N/A';
    const files = Array.isArray(doc?.data?.files) ? doc.data.files : [];
    const commitSha = doc?.meta?.commitSha || 'N/A';

    const html = getContributionNotificationTemplate({
      cid,
      contributor,
      submittedAt: submittedAt.toISOString(),
      semester,
      subject,
      category,
      files,
      commitSha,
    });

    const text = [
      'Contribution notification replay',
      `CID: ${cid}`,
      `Contributor: ${contributor}`,
      `Submitted At: ${submittedAt.toISOString()}`,
      `Semester: ${semester}`,
      `Subject: ${subject}`,
      `Category: ${category}`,
      `Files: ${files.map((f) => f.filename || f.name).join(', ') || 'N/A'}`,
      `Commit: ${commitSha}`,
    ].join('\n');

    const attachments = [];
    const stickerPath = path.join(process.cwd(), 'assets', 'img', 'sticker.png');
    if (fs.existsSync(stickerPath)) {
      attachments.push({
        filename: 'sticker.png',
        path: stickerPath,
        cid: 'materio-logo',
      });
    }

    const result = await sendAlertEmail({
      to: ALERT_EMAIL,
      subject: `[Contribution Replay] ${cid} | ${subject}`,
      text,
      html,
      attachments,
    });

    console.log(
      JSON.stringify({
        success: result.success,
        messageId: result.messageId || null,
        error: result.error || null,
        to: ALERT_EMAIL,
        sourceSubmissionId: String(doc._id),
        cid,
        attachedSticker: attachments.length > 0,
      }),
    );

    await closeMongoConnection();
    if (!result.success) process.exit(2);
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }));
    try {
      await closeMongoConnection();
    } catch (_) {}
    process.exit(3);
  }
})();
