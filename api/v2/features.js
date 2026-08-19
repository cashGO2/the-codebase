const { google } = require("googleapis");
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const fs = require("fs");
const path = require("path");
const formidable = require("formidable");
const yaml = require("js-yaml");
const {
  verifyToken,
  corsHeaders,
  getTokenFromHeaders,
  supabase,
  supabaseAdmin,
} = require("./_utils");
const { getFormsCollection, getMongoDb } = require("../_config_shared/mongodb");
const { sendAlertEmail, ALERT_EMAIL } = require("../_utils_shared/mailer");
const {
  isWebPushConfigured,
  getVapidPublicKey,
  upsertWebPushSubscription,
  removeWebPushSubscription,
} = require("../_utils_shared/webpush");
const {
  getContributionNotificationTemplate,
} = require("../_utils_shared/email-templates");
const { ObjectId } = require("mongodb");
require("dotenv").config();
const Razorpay = require("razorpay");
const crypto = require("crypto");

// ==========================================
// Google Drive Configuration
// ==========================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "https://materioa.vercel.app/account/profile.html";

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
);

const drive = google.drive({ version: "v3", auth: oauth2Client });

// ==========================================
// Google Analytics Configuration
// ==========================================
const base64Key = process.env.GA_SERVICE_ACCOUNT_KEY_BASE64;
const credentials = base64Key
  ? JSON.parse(Buffer.from(base64Key, "base64").toString())
  : null;
const analyticsDataClient = credentials
  ? new BetaAnalyticsDataClient({ credentials })
  : null;

// ==========================================
// Razorpay Configuration
// ==========================================
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay = RAZORPAY_KEY_ID
  ? new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    })
  : null;

// ==========================================
// Main Handler
// ==========================================
module.exports = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Parse query parameters manually if req.query is not available
    const queryParams = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Determine which feature is being requested
    // Check path first
    const isInsights = url.pathname.includes("/insights");
    const isSavePromo = url.pathname.includes("/save-promo");
    const isGoogleDrive = url.pathname.includes("/google-drive");
    const isSharelink = url.pathname.includes("/sharelink");

    const isForms = url.pathname.includes("/forms");
    const isContribute = url.pathname.includes("/contribute");
    const isNotebooks = url.pathname.includes("/notebooks");
    const isSubscription = url.pathname.includes("/subscription");
    const isWebPush = url.pathname.includes("/web-push");
    const isPromotions = url.pathname.includes("/promotions");
    const isReleases = url.pathname.includes("/releases");
    const isExamdata = url.pathname.includes("/examdata");
    const isNotifications = url.pathname.includes("/notifications");

    // Check query param action
    const action = queryParams.action || req.query?.action;
    const pathParam = queryParams.path || "";

    console.log(
      "Features API - pathname:",
      url.pathname,
      "action:",
      action,
      "pathParam:",
      pathParam,
    );

    if (action === "analytics-views" || action === "views") {
      return await handleAnalyticsViews(req, res, url);
    }

    if (action === "analytics-leaderboard" || action === "leaderboard") {
      return await handleAnalyticsLeaderboard(req, res, url);
    }

    if (action === "analytics") {
      return await handleAnalytics(req, res);
    }

    if (action === "notifications-feed") {
      return await handleNotificationsFeed(req, res);
    }

    if (isInsights || action === "insights" || pathParam.includes("insights")) {
      return await handleInsights(req, res);
    }

    if (
      isSavePromo ||
      action === "save-promo" ||
      pathParam.includes("save-promo")
    ) {
      return await handleSavePromo(req, res);
    }

    if (
      isGoogleDrive ||
      action === "google-drive" ||
      pathParam.includes("google-drive")
    ) {
      return await handleGoogleDrive(req, res, url);
    }

    if (
      isSharelink ||
      action === "sharelink" ||
      pathParam.includes("sharelink")
    ) {
      return await handleSharelink(req, res);
    }

    if (isForms || action === "forms" || pathParam.includes("forms")) {
      return await handleForms(req, res, url);
    }

    if (
      isContribute ||
      action === "contribute" ||
      pathParam.includes("contribute")
    ) {
      return await handleContribute(req, res);
    }

    if (
      isNotebooks ||
      action === "notebooks" ||
      pathParam.includes("notebooks")
    ) {
      return await handleNotebooks(req, res, url);
    }

    if (
      isSubscription ||
      action === "subscription" ||
      pathParam.includes("subscription")
    ) {
      return await handleSubscription(req, res, url);
    }

    if (isWebPush || action === "web-push" || pathParam.includes("web-push")) {
      return await handleWebPush(req, res, url);
    }

    if (
      url.pathname.includes("/pdf-share") ||
      pathParam.includes("pdf-share") ||
      action === "pdf-share"
    ) {
      return await handlePdfShare(req, res, url);
    }

    if (
      isPosts ||
      action === "posts" ||
      pathParam.includes("posts")
    ) {
      return await handlePosts(req, res, url);
    }

    if (
      isPromotions ||
      action === "promotions" ||
      pathParam.includes("promotions")
    ) {
      return await handlePromotionsFeature(req, res);
    }

    if (
      isReleases ||
      action === "releases" ||
      pathParam.includes("releases")
    ) {
      return await handleReleasesFeature(req, res);
    }

    if (
      isExamdata ||
      action === "examdata" ||
      pathParam.includes("examdata")
    ) {
      return await handleExamdataFeature(req, res);
    }

    if (
      isNotifications ||
      action === "notifications" ||
      pathParam.includes("notifications")
    ) {
      return await handleNotificationsFeature(req, res);
    }

    return res.status(404).json({
      error: "Feature not found",
      debug: {
        pathname: url.pathname,
        action: action,
        pathParam: pathParam,
        availableFeatures: [
          "insights",
          "save-promo",
          "google-drive",
          "sharelink",
          "forms",
          "contribute",
          "notebooks",
          "pdf-share",
          "web-push",
          "views",
          "leaderboard",
          "analytics-views",
          "analytics-leaderboard",
          "notifications-feed",
          "posts",
        ],
      },
    });
  } catch (error) {
    console.error("Features API error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

// ==========================================
// Feature Handlers
// ==========================================

async function handleInsights(req, res) {
  if (!analyticsDataClient) {
    console.error("GA_SERVICE_ACCOUNT_KEY_BASE64 not configured");
    return res.status(500).json({ error: "Analytics not configured" });
  }

  try {
    console.log("Handling insights request...");
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      dimensions: [{ name: "unifiedScreenName" }],
      metrics: [{ name: "activeUsers" }],
    });

    const users = response.rows?.[0]?.metricValues?.[0]?.value || "0";

    // Set headers
    const origin = req.headers.origin || req.headers.Origin;
    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.setHeader("Cache-Control", "no-store");

    console.log("Insights response:", { users });
    return res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching real-time users:", error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleNotificationsFeed(req, res) {
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader("Cache-Control", "no-store");

  const limitParam = Number(req.query?.num);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 6;

  const useLocalResources = process.env.USE_LOCAL_RESOURCES === "true";
  const sources = [
    ...(useLocalResources ? ["http://localhost:8080/notifications.json"] : []),
    "https://cdn.getmaterio.app/notifications.json",
    "https://cdn-materioa.netlify.app/notifications.json"
  ];

  for (const source of sources) {
    try {
      const response = await fetch(`${source}?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const notifications = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : [];

      if (notifications.length > 0) {
        return res.status(200).json(notifications.slice(0, limit));
      }
    } catch (error) {
      // Try next source
    }
  }

  return res.status(200).json([]);
}

async function handleSavePromo(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const promoData = req.body;
    const jsonContent = JSON.stringify(promoData, null, 2);

    // Define file paths relative to the Netlify build
    // Note: In Vercel serverless environment, writing to file system is ephemeral and usually not what you want for persistence.
    // But preserving the logic as requested.
    const sourceFile = path.join(process.cwd(), "assets", "data", "promo.json");
    const siteFile = path.join(
      process.cwd(),
      "_site",
      "assets",
      "data",
      "promo.json",
    );

    console.log("Saving promo data to:", sourceFile);

    // Ensure directories exist
    const sourceDir = path.dirname(sourceFile);
    const siteDir = path.dirname(siteFile);

    if (!fs.existsSync(sourceDir)) {
      fs.mkdirSync(sourceDir, { recursive: true });
    }

    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
    }

    // Write to both files
    fs.writeFileSync(sourceFile, jsonContent);
    fs.writeFileSync(siteFile, jsonContent);

    return res.status(200).json({
      success: true,
      message: "Promotion data saved successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error saving promo files:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async function handleGoogleDrive(req, res, url) {
  const { method, headers } = req;
  const body = req.body || {};

  // Extract auth token
  const authHeader = headers.authorization || headers.Authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Determine sub-endpoint
  // URL might be /api/v2/features/google-drive/auth-url or /api/v2/google-drive/auth-url
  // We look for the part after 'google-drive'
  let endpoint = "";
  const pathParts = url.pathname.split("/");
  const driveIndex = pathParts.indexOf("google-drive");
  if (driveIndex !== -1 && driveIndex < pathParts.length - 1) {
    endpoint = pathParts[driveIndex + 1];
  } else {
    // Fallback: check query param
    endpoint = req.query.subAction || "";
  }

  // Also check if it's a delete action with ID
  if (url.pathname.includes("/delete/")) {
    endpoint = "delete";
  }

  switch (method) {
    case "GET":
      if (endpoint === "auth-url") {
        // Generate Google OAuth URL
        const scopes = [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/userinfo.profile",
        ];

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: scopes,
          state: user.id, // Pass user ID in state
        });

        return res.status(200).json({ authUrl });
      }

      if (endpoint === "status") {
        // Check if user has linked Google Drive
        const tokens = await getGoogleTokens(user.id);
        const linked = !!tokens;

        let materioFolderId = null;
        if (linked && tokens.access_token) {
          try {
            oauth2Client.setCredentials({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
            });

            // Check if materio folder exists
            materioFolderId = await findOrCreateMaterioFolder();
          } catch (error) {
            console.error("Error checking materio folder:", error);
          }
        }

        return res.status(200).json({
          linked,
          materioFolderId,
        });
      }

      if (endpoint === "files") {
        // List user's files from Google Drive
        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: "Google Drive not linked" });
        }

        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: "Failed to refresh tokens" });
        }

        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token,
        });
        try {
          // Get the folderId from query parameters if provided
          const { folderId } = req.query;

          let query = "trashed=false";
          if (folderId) {
            query += ` and '${folderId}' in parents`;
          } else {
            // Default to materio folder
            const materioFolderId = await findOrCreateMaterioFolder();
            query += ` and '${materioFolderId}' in parents`;
          }

          const response = await drive.files.list({
            pageSize: 50,
            fields:
              "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink)",
            q: query,
          });

          return res.status(200).json({ files: response.data.files });
        } catch (error) {
          console.error("Error listing files:", error);
          return res.status(500).json({ error: "Failed to list files" });
        }
      }
      break;

    case "POST":
      if (endpoint === "callback") {
        // Handle OAuth callback
        const { code, state } = body;

        if (state !== user.id) {
          return res.status(400).json({ error: "Invalid state parameter" });
        }

        try {
          const { tokens } = await oauth2Client.getToken(code);
          await storeGoogleTokens(user.id, tokens);

          return res.status(200).json({ success: true });
        } catch (error) {
          console.error("Error exchanging code for tokens:", error);
          return res
            .status(400)
            .json({ error: "Failed to exchange code for tokens" });
        }
      }

      if (endpoint === "ensure-folder") {
        // Ensure materio folder exists
        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: "Google Drive not linked" });
        }

        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: "Failed to refresh tokens" });
        }

        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token,
        });

        try {
          const folderId = await findOrCreateMaterioFolder();
          return res.status(200).json({ folderId });
        } catch (error) {
          console.error("Error ensuring materio folder:", error);
          return res
            .status(500)
            .json({ error: "Failed to ensure materio folder" });
        }
      }

      if (endpoint === "upload") {
        // Upload file to Google Drive
        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: "Google Drive not linked" });
        }

        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: "Failed to refresh tokens" });
        }

        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token,
        });
        const { fileName, fileContent, mimeType, folderId } = body;

        try {
          // Use provided folderId or default to materio folder
          const targetFolderId =
            folderId || (await findOrCreateMaterioFolder());

          const response = await drive.files.create({
            requestBody: {
              name: fileName,
              parents: [targetFolderId], // Upload to materio folder
            },
            media: {
              mimeType: mimeType,
              body: Buffer.from(fileContent, "base64"),
            },
          });

          return res.status(200).json({
            success: true,
            fileId: response.data.id,
            fileName: response.data.name,
          });
        } catch (error) {
          console.error("Error uploading file:", error);
          return res.status(500).json({ error: "Failed to upload file" });
        }
      }

      break;

    case "DELETE":
      if (endpoint === "unlink") {
        // Unlink Google Drive
        try {
          const { error } = await supabase
            .from("google_drive_tokens")
            .delete()
            .eq("user_id", user.id);

          if (error) throw error;

          return res.status(200).json({ success: true });
        } catch (error) {
          console.error("Error unlinking Google Drive:", error);
          return res
            .status(500)
            .json({ error: "Failed to unlink Google Drive" });
        }
      }

      // Handle file deletion by ID
      // Assuming the URL is like /api/v2/google-drive/delete/FILE_ID
      // or we parse it from the path
      const deleteMatch = url.pathname.match(/\/delete\/(.+)$/);
      if (deleteMatch) {
        const fileId = deleteMatch[1];

        const tokens = await getGoogleTokens(user.id);
        if (!tokens) {
          return res.status(400).json({ error: "Google Drive not linked" });
        }

        const refreshedTokens = await refreshTokensIfNeeded(user.id, tokens);
        if (!refreshedTokens) {
          return res.status(400).json({ error: "Failed to refresh tokens" });
        }

        oauth2Client.setCredentials({
          access_token: refreshedTokens.access_token,
          refresh_token: refreshedTokens.refresh_token,
        });

        try {
          await drive.files.delete({
            fileId: fileId,
          });

          return res.status(200).json({ success: true });
        } catch (error) {
          console.error("Error deleting file:", error);
          return res.status(500).json({ error: "Failed to delete file" });
        }
      }

      break;

    default:
      return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(404).json({ error: "Endpoint not found" });
}

async function handleSharelink(req, res) {
  const origin = req.headers.origin || req.headers.Origin;

  // Auth checks
  const token = getTokenFromHeaders(req.headers);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("id", decoded.id)
    .single();

  if (userError || !user) {
    return res.status(401).json({ error: "User not found" });
  }

  if (req.method === "POST") {
    return await createSharelink(req, res, origin, user.id);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

// Create shareable link for invite
async function createSharelink(req, res, origin, userId) {
  try {
    console.log("Creating sharelink, user ID:", userId);

    // Parse request body
    const bodyData = req.body;
    const inviteCode = bodyData.inviteCode;
    const customHeading = bodyData.customHeading;

    console.log("Sharelink params:", { inviteCode, customHeading });

    if (!inviteCode) {
      return res.status(400).json({ error: "Invite code is required" });
    }

    // Verify that the invite exists and belongs to this user
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("id, code, created_by, contains_plus_perks")
      .eq("code", inviteCode)
      .eq("created_by", userId)
      .single();

    console.log("Invite lookup result:", { invite, inviteError });
    console.log("User ID for comparison:", userId);

    if (inviteError) {
      console.error("Invite lookup error:", inviteError);
      return res
        .status(404)
        .json({ error: "Invite lookup failed", details: inviteError });
    }

    if (!invite) {
      console.error("Invite not found or access denied");
      // Try to lookup the invite without the user filter to see if it exists at all
      const { data: anyInvite } = await supabase
        .from("invites")
        .select("created_by")
        .eq("code", inviteCode)
        .single();

      if (anyInvite) {
        console.log("Invite exists but belongs to user:", anyInvite.created_by);
        return res
          .status(403)
          .json({ error: "You do not have permission to share this invite" });
      } else {
        return res.status(404).json({ error: "Invite not found" });
      }
    }

    // Create the sharelink record
    console.log("Creating sharelink for invite code:", inviteCode);

    // First try with standard method
    let sharelink, sharelinkError;

    try {
      const result = await supabase
        .from("sharelinks")
        .upsert(
          {
            invite_code: inviteCode,
            custom_heading: customHeading || null,
            created_by: userId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "invite_code",
          },
        )
        .select()
        .single();

      sharelink = result.data;
      sharelinkError = result.error;
    } catch (e) {
      console.log(
        "Standard sharelink creation failed, trying fallback method:",
        e.message,
      );
      sharelinkError = e;
    }

    // If the standard method fails due to RLS, try using direct SQL
    if (
      sharelinkError &&
      sharelinkError.message.includes("row-level security")
    ) {
      try {
        console.log("Attempting direct SQL insertion to bypass RLS...");

        // Use RPC to execute SQL directly
        const timestamp = new Date().toISOString();
        const sql = `
          INSERT INTO sharelinks (invite_code, custom_heading, created_by, updated_at)
          VALUES ('${inviteCode}', ${customHeading ? `'${customHeading.replace(/'/g, "''")}'` : "NULL"}, '${userId}', '${timestamp}')
          ON CONFLICT (invite_code)
          DO UPDATE SET
            custom_heading = ${customHeading ? `'${customHeading.replace(/'/g, "''")}'` : "NULL"},
            updated_at = '${timestamp}'
          RETURNING *;
        `;

        const { data, error } = await supabase.rpc("execute_sql", {
          sql_command: sql,
        });

        if (error) {
          console.error("Direct SQL insertion failed:", error);
          sharelinkError = error;
        } else {
          console.log("Direct SQL insertion succeeded:", data);
          // Parse the returned data
          try {
            const parsedData =
              typeof data === "string" ? JSON.parse(data) : data;
            sharelink =
              parsedData && parsedData.length > 0 ? parsedData[0] : null;
            sharelinkError = null;
          } catch (parseError) {
            console.error("Error parsing SQL result:", parseError);
            sharelink = null;
            sharelinkError = parseError;
          }
        }
      } catch (sqlError) {
        console.error("Error executing direct SQL:", sqlError);
        sharelinkError = sqlError;
      }
    }

    console.log("Final sharelink creation result:", {
      sharelink,
      sharelinkError,
    });

    if (sharelinkError) {
      console.error("Sharelink creation error:", sharelinkError);
      return res
        .status(500)
        .json({
          error: "Failed to create sharelink",
          details: sharelinkError.message,
        });
    }

    // Determine the base URL based on the environment
    const isLocalhost =
      origin && (origin.includes("localhost") || origin.includes("127.0.0.1"));
    const baseUrl = isLocalhost ? origin : "https://materioa.vercel.app";

    // Even if we don't have a sharelink object, we can still return a valid URL
    // This handles the case where the database operation succeeded but didn't return data
    if (!sharelink) {
      console.warn(
        "No sharelink returned after upsert, but proceeding with URL generation",
      );

      // Create a minimal response with just the URL
      let url = `${baseUrl}/invites/${inviteCode}`;

      return res.status(200).json({
        message:
          "Sharelink created (DB update may have succeeded without returning data)",
        url: url,
        inviteCode: inviteCode,
        customHeading: customHeading,
      });
    }

    // Return the sharelink data
    return res.status(200).json({
      message: "Sharelink created successfully",
      sharelink: {
        inviteCode: sharelink.invite_code,
        customHeading: sharelink.custom_heading,
        url: `${baseUrl}/invites/${sharelink.invite_code}`,
        createdAt: sharelink.created_at,
        updatedAt: sharelink.updated_at,
      },
    });
  } catch (error) {
    console.error("Create sharelink error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
}

// ==========================================
// Google Drive Helpers
// ==========================================

const getUserFromToken = async (token) => {
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", decoded.id)
    .single();

  return user;
};

const storeGoogleTokens = async (userId, tokens) => {
  const { error } = await supabase.from("google_drive_tokens").upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    updated_at: new Date(),
  });

  return !error;
};

const getGoogleTokens = async (userId) => {
  const { data: tokens } = await supabase
    .from("google_drive_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  return tokens;
};

const refreshTokensIfNeeded = async (userId, tokens) => {
  if (new Date() < new Date(tokens.expires_at)) {
    return tokens;
  }

  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await storeGoogleTokens(userId, credentials);
    return await getGoogleTokens(userId);
  } catch (error) {
    console.error("Error refreshing tokens:", error);
    return null;
  }
};

const findOrCreateMaterioFolder = async () => {
  try {
    // First, search for existing materio folder
    const response = await drive.files.list({
      q: "name='materio' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id, name)",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id;
    }

    // If not found, create the folder
    const folderResponse = await drive.files.create({
      resource: {
        name: "materio",
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    return folderResponse.data.id;
  } catch (error) {
    console.error("Error finding/creating materio folder:", error);
    throw error;
  }
};

// ==========================================
// Forms Handler
// ==========================================
async function handleForms(req, res, url) {
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const { method } = req;
  const pathParts = url.pathname.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  try {
    // GET /forms/config - Return forms configuration
    if (method === "GET" && lastPart === "config") {
      const configPath = path.join(
        process.cwd(),
        "assets",
        "data",
        "forms-config.json",
      );
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        return res.status(200).json(config);
      }
      return res
        .status(200)
        .json({
          message: "Forms config available at /assets/data/forms-config.json",
        });
    }

    switch (method) {
      case "POST":
        return await submitForm(req, res);
      case "GET":
        if (lastPart && lastPart !== "forms" && !lastPart.includes("?")) {
          return await getFormSubmission(req, res, lastPart);
        }
        return await listFormSubmissions(req, res);
      case "PUT":
        return await updateFormSubmission(req, res, lastPart);
      case "DELETE":
        return await deleteFormSubmission(req, res, lastPart);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Forms handler error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
}

// ==========================================
// Notebooks Handler
// ==========================================
async function handleNotebooks(req, res, url) {
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const method = req.method;
  const token = getTokenFromHeaders(req.headers) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Get full user profile to check privileges
  let privileges = { isPlusUser: false, hasAdminPrivileges: false };
  try {
    const { data: userData, error } = await supabase
      .from("users")
      .select("is_plus_user, has_admin_privileges")
      .eq("id", user.id)
      .single();

    if (!error && userData) {
      privileges.isPlusUser = userData.is_plus_user;
      privileges.hasAdminPrivileges = userData.has_admin_privileges;
    }
  } catch (e) {
    console.error("Error fetching user privileges:", e);
  }

  // Enforce Plus/Super requirement
  if (!privileges.isPlusUser && !privileges.hasAdminPrivileges) {
    return res
      .status(403)
      .json({ error: "This feature requires Plus or Admin privileges" });
  }

  const queryParams = {};
  url.searchParams.forEach((value, key) => (queryParams[key] = value));
  const subAction = queryParams.subAction || req.body?.subAction;

  try {
    const db = await getMongoDb();
    const collection = db.collection("notebooks");

    // SYNC (Upsert)
    if (method === "POST" && subAction === "sync") {
      const notebook = req.body.notebook;
      if (!notebook || !notebook.id) {
        return res.status(400).json({ error: "Invalid notebook data" });
      }

      await collection.updateOne(
        { id: notebook.id, userId: user.id },
        {
          $set: {
            ...notebook,
            userId: user.id,
            syncedAt: new Date().toISOString(),
          },
        },
        { upsert: true },
      );

      return res
        .status(200)
        .json({ success: true, message: "Notebook synced" });
    }

    // DELETE
    if (method === "DELETE" || (method === "POST" && subAction === "delete")) {
      const notebookId = queryParams.id || req.body?.id || req.body?.notebookId;
      if (!notebookId) {
        return res.status(400).json({ error: "Notebook ID required" });
      }

      await collection.deleteOne({ id: notebookId, userId: user.id });
      return res
        .status(200)
        .json({ success: true, message: "Notebook deleted from cloud" });
    }

    // LIST (Load)
    if (method === "GET" || (method === "POST" && subAction === "list")) {
      const notebooks = await collection.find({ userId: user.id }).toArray();
      // Remove internal _id before sending
      const cleanNotebooks = notebooks.map(({ _id, ...n }) => n);

      return res.status(200).json({ notebooks: cleanNotebooks });
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    console.error("Notebooks API error:", error);
    return res.status(503).json({
      error:
        "Cloud Sync is temporarily unavailable (Database offline). Your notes are saved locally and will sync once the server resumes.",
      details: error.message,
    });
  }
}

// End of file

async function submitForm(req, res) {
  const { formType, user, data, confirmations } = req.body;

  if (!formType) {
    return res.status(400).json({ error: "Form type is required" });
  }
  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Form data is required" });
  }

  let authenticatedUser = null;
  const token = getTokenFromHeaders(req.headers);
  if (token) {
    authenticatedUser = verifyToken(token);
  }

  const userInfo = {
    type: user?.type || "anonymous",
    userId: authenticatedUser?.id || null,
    email: authenticatedUser?.email || user?.email || null,
    githubUsername: user?.githubUsername || null,
    displayName: authenticatedUser?.username || user?.displayName || null,
  };

  const meta = {
    ip: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    referrer: req.headers["referer"] || null,
    submittedFrom: req.headers.origin || null,
  };

  const submission = {
    formType,
    submittedAt: new Date(),
    user: userInfo,
    data,
    confirmations: confirmations || {},
    meta,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
  };

  // Respond immediately — DB write happens in background
  res.status(201).json({
    success: true,
    message: "Form submitted successfully",
    submissionId: "pending",
  });

  // Background: save to MongoDB (user already has their response)
  (async () => {
    try {
      const collection = await getFormsCollection();
      await collection.insertOne(submission);
    } catch (error) {
      console.error("Background form save failed:", error.message);
    }
  })();
}

async function listFormSubmissions(req, res) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const formType = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit")) || 50;
  const skip = parseInt(url.searchParams.get("skip")) || 0;

  const filter = {};
  if (formType) filter.formType = formType;
  if (status) filter.status = status;

  try {
    const collection = await getFormsCollection();
    const [submissions, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return res.status(200).json({
      submissions,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + submissions.length < total,
      },
    });
  } catch (error) {
    console.error("Error listing submissions:", error);
    return res.status(500).json({ error: "Failed to list submissions" });
  }
}

async function getFormSubmission(req, res, id) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  try {
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid submission ID" });
    const collection = await getFormsCollection();
    const submission = await collection.findOne({ _id: new ObjectId(id) });
    if (!submission)
      return res.status(404).json({ error: "Submission not found" });
    return res.status(200).json(submission);
  } catch (error) {
    console.error("Error getting submission:", error);
    return res.status(500).json({ error: "Failed to get submission" });
  }
}

async function updateFormSubmission(req, res, id) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { status, notes } = req.body;
  if (
    !status ||
    !["pending", "approved", "rejected", "processed"].includes(status)
  ) {
    return res.status(400).json({ error: "Valid status required" });
  }

  try {
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid submission ID" });
    const collection = await getFormsCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          reviewedBy: user.id,
          reviewedAt: new Date(),
          reviewNotes: notes || null,
        },
      },
    );
    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Submission not found" });
    return res
      .status(200)
      .json({ success: true, message: "Submission updated" });
  } catch (error) {
    console.error("Error updating submission:", error);
    return res.status(500).json({ error: "Failed to update submission" });
  }
}

async function deleteFormSubmission(req, res, id) {
  const token = getTokenFromHeaders(req.headers);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  try {
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid submission ID" });
    const collection = await getFormsCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Submission not found" });
    return res
      .status(200)
      .json({ success: true, message: "Submission deleted" });
  } catch (error) {
    console.error("Error deleting submission:", error);
    return res.status(500).json({ error: "Failed to delete submission" });
  }
}

// ==========================================
// Contribute Handler (GitHub Upload)
// ==========================================
const CONTRIB_REPO_OWNER = "Materioa";
const CONTRIB_REPO_NAME = "static";
const CONTRIB_BRANCH = "main";

function generateContributionCid(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `CID-${y}${m}${d}-${hh}${mm}${ss}-${suffix}`;
}

function formatContributionTimestamp(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: "Asia/Kolkata",
    }).format(date);
  } catch (_) {
    return date.toISOString();
  }
}

async function handleContribute(req, res) {
  const { Octokit } = await import("@octokit/rest");
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.GITHUB_TOKEN) {
      return res.status(500).json({ error: "GitHub token not configured" });
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Increase limits if running locally
    const isLocalhost = req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
    const maxAllowedSize = isLocalhost ? 500 * 1024 * 1024 : 6 * 1024 * 1024;

    const form = new formidable.IncomingForm({
      multiples: true,
      maxFileSize: maxAllowedSize,
      maxTotalFileSize: maxAllowedSize,
      keepExtensions: true,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const getValue = (key) => {
      const val = fields[key];
      return Array.isArray(val) ? val[0] : val;
    };

    const semester = getValue("semester");
    const subject = getValue("subject");
    const category = getValue("category");
    const userType = getValue("userType") || "anonymous";
    const username = getValue("username") || null;
    const githubUsername = getValue("githubUsername") || null;

    if (!semester || !subject || !category) {
      return res
        .status(400)
        .json({
          error: "Missing required fields: semester, subject, category",
        });
    }

    const uploadedFilesList = files.files;
    if (!uploadedFilesList) {
      return res.status(400).json({ error: "No files provided" });
    }

    const fileList = Array.isArray(uploadedFilesList)
      ? uploadedFilesList
      : [uploadedFilesList];

    for (const file of fileList) {
      if (!file.originalFilename.toLowerCase().endsWith(".pdf")) {
        return res
          .status(400)
          .json({
            error: `Only PDF files allowed. "${file.originalFilename}" is not a PDF.`,
          });
      }
    }

    let contributor = "Anonymous";
    if (userType === "authenticated" && username) contributor = username;
    else if (userType === "github" && githubUsername)
      contributor = `GitHub: ${githubUsername}`;

    console.log(
      `Contribution: ${fileList.length} files for ${subject} - ${category} by ${contributor}`,
    );

    const { data: ref } = await octokit.rest.git.getRef({
      owner: CONTRIB_REPO_OWNER,
      repo: CONTRIB_REPO_NAME,
      ref: `heads/${CONTRIB_BRANCH}`,
    });
    const latestCommitSha = ref.object.sha;
    const { data: latestCommit } = await octokit.rest.git.getCommit({
      owner: CONTRIB_REPO_OWNER,
      repo: CONTRIB_REPO_NAME,
      commit_sha: latestCommitSha,
    });
    const baseTreeSha = latestCommit.tree.sha;

    const treeItems = [];
    const uploadedFiles = [];
    const basePath = `pdfs/${semester}/${subject}`;

    for (const file of fileList) {
      const filePath = `${basePath}/${file.originalFilename}`;
      const content = fs.readFileSync(file.filepath);
      const { data: blob } = await octokit.rest.git.createBlob({
        owner: CONTRIB_REPO_OWNER,
        repo: CONTRIB_REPO_NAME,
        content: content.toString("base64"),
        encoding: "base64",
      });
      treeItems.push({
        path: filePath,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
      uploadedFiles.push({
        name: file.originalFilename.replace(/\.[^/.]+$/, ""),
        path: filePath,
        filename: file.originalFilename,
        size: file.size,
      });
    }

    const { data: newTree } = await octokit.rest.git.createTree({
      owner: CONTRIB_REPO_OWNER,
      repo: CONTRIB_REPO_NAME,
      base_tree: baseTreeSha,
      tree: treeItems,
    });

    const commitMessage = `Contribution: ${uploadedFiles.length} file(s) for ${subject} - ${category} (by ${contributor})`;
    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: CONTRIB_REPO_OWNER,
      repo: CONTRIB_REPO_NAME,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    await octokit.rest.git.updateRef({
      owner: CONTRIB_REPO_OWNER,
      repo: CONTRIB_REPO_NAME,
      ref: `heads/${CONTRIB_BRANCH}`,
      sha: newCommit.sha,
    });

    console.log("Contribution uploaded:", newCommit.sha);

    const submittedAt = new Date();
    const contributionCid = generateContributionCid(submittedAt);

    // Log to MongoDB
    try {
      const collection = await getFormsCollection();
      await collection.insertOne({
        contributionCid,
        formType: "contribution",
        submittedAt,
        user: {
          type: userType,
          username,
          githubUsername,
          displayName: contributor,
        },
        data: { semester, subject, category, files: uploadedFiles },
        meta: {
          ip:
            req.headers["x-forwarded-for"] ||
            req.headers["x-real-ip"] ||
            "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
          commitSha: newCommit.sha,
        },
        status: "uploaded",
      });

      // Notify admin mailbox for SLA tracking (under 48h review policy).
      const mailText = [
        "New contribution received",
        `CID: ${contributionCid}`,
        `Contributor: ${contributor}`,
        `Submitted At: ${submittedAt.toISOString()}`,
        `Semester: ${semester}`,
        `Subject: ${subject}`,
        `Category: ${category}`,
        `Files: ${uploadedFiles.map((f) => f.filename).join(", ")}`,
        `Commit: ${newCommit.sha}`,
      ].join("\n");

      const mailHtml = getContributionNotificationTemplate({
        cid: contributionCid,
        contributor,
        submittedAt: formatContributionTimestamp(submittedAt),
        semester,
        subject,
        category,
        files: uploadedFiles,
        commitSha: newCommit.sha,
      });

      const contributionMailAttachments = [];
      const logoPath = path.join(process.cwd(), "assets", "img", "sticker.png");
      if (fs.existsSync(logoPath)) {
        contributionMailAttachments.push({
          filename: "sticker.png",
          path: logoPath,
          cid: "materio-logo",
        });
      }

      const mailResult = await sendAlertEmail({
        to: ALERT_EMAIL,
        subject: `[Contribution Received] ${contributionCid} | ${subject}`,
        text: mailText,
        html: mailHtml,
        attachments: contributionMailAttachments,
      });

      if (!mailResult.success) {
        console.warn(
          "Contribution notification email failed:",
          mailResult.error,
        );
      }
    } catch (mongoError) {
      console.error("MongoDB logging error:", mongoError.message);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      contributionCid,
      commitSha: newCommit.sha,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Contribute error:", error);
    let errorMessage = "Upload failed";
    let statusCode = 500;

    if (error.status === 413) {
      errorMessage = "File too large (max 6MB)";
      statusCode = 413;
    } else if (error.status === 403) {
      errorMessage = `GitHub permission denied. Check token access to ${CONTRIB_REPO_OWNER}/${CONTRIB_REPO_NAME}`;
      statusCode = 403;
    } else if (error.status === 404) {
      errorMessage = `Repository ${CONTRIB_REPO_OWNER}/${CONTRIB_REPO_NAME} not found`;
      statusCode = 404;
    } else if (error.message) errorMessage = `Upload failed: ${error.message}`;

    return res.status(statusCode).json({ error: errorMessage });
  }
}

// ==========================================
// Web Push Handler (VAPID Subscription APIs)
// ==========================================
async function handleWebPush(req, res, url) {
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const subAction = url.searchParams.get("subAction") || req.query?.subAction;

  if (subAction === "public-key") {
    if (!isWebPushConfigured()) {
      return res.status(503).json({ error: "Web push is not configured" });
    }
    return res.status(200).json({ publicKey: getVapidPublicKey() });
  }

  if (subAction === "subscribe") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    if (!isWebPushConfigured()) {
      return res.status(503).json({ error: "Web push is not configured" });
    }

    try {
      const body =
        req.body && typeof req.body === "string"
          ? JSON.parse(req.body)
          : (req.body || {});

      const subscription = body?.subscription;
      if (!subscription) {
        return res.status(400).json({ error: "subscription is required" });
      }

      await upsertWebPushSubscription(subscription, {
        userAgent: req.headers["user-agent"] || null,
        ip: req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || null,
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid subscription" });
    }
  }

  if (subAction === "unsubscribe") {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const body =
        req.body && typeof req.body === "string"
          ? JSON.parse(req.body)
          : (req.body || {});

      const endpoint = body?.endpoint || body?.subscription?.endpoint;
      if (!endpoint) {
        return res.status(400).json({ error: "endpoint is required" });
      }

      await removeWebPushSubscription(endpoint);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(400).json({ error: "Invalid unsubscribe payload" });
    }
  }

  return res.status(404).json({ error: "Web push action not found" });
}

// ==========================================
// Subscription Handler
// ==========================================
async function handleSubscription(req, res, url) {
  const subAction = url.searchParams.get("subAction") || req.query?.subAction;

  // Auth check
  const token = getTokenFromHeaders(req.headers);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid token" });
  const userId = decoded.id;

  if (subAction === "create-order") {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    if (!razorpay) {
      console.error(
        "Razorpay not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env",
      );
      return res.status(500).json({
        error: "Razorpay not configured",
        details:
          "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing from server environment.",
      });
    }

    try {
      // SECURITY: Price is determined server-side only, never trust frontend price
      const { plan } = req.body;

      // Validate plan and set price server-side
      const PLAN_PRICES = {
        plus_subscription: 5900, // ₹59 (3-month subscription)
        pro_lifetime: 29900, // ₹299 (lifetime)
      };

      const amount = PLAN_PRICES[plan];
      if (!amount) {
        return res.status(400).json({ error: "Invalid plan selected" });
      }

      const options = {
        amount: amount,
        currency: "INR",
        receipt: `receipt_${plan}_${userId.substring(0, 8)}_${Date.now()}`,
        notes: {
          userId,
          plan: plan,
        },
      };

      const order = await razorpay.orders.create(options);
      return res.status(200).json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpayKey: RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error("Razorpay order creation error:", error);
      return res.status(500).json({
        error: "Failed to create order",
        details: error.message || error.toString() || "Unknown Razorpay error",
      });
    }
  }

  if (subAction === "verify-payment") {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan } =
      req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ error: "Missing payment verification details" });
    }

    // Verify signature
    try {
      const hmac = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET);
      hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
      const generatedSignature = hmac.digest("hex");

      if (generatedSignature !== razorpay_signature) {
        console.error("Invalid signature detected");
        return res.status(400).json({ error: "Invalid payment signature" });
      }

      console.log(
        `Payment verified for order ${razorpay_order_id}, upgrading user ${userId} to ${plan}`,
      );

      // Update user tier in Supabase
      // Note: is_plus_user = Pro tier (₹299 lifetime) - old Plus rebranded
      //       is_lite_user = Plus tier (₹59/3mo subscription) - new tier
      const updateData = {};
      if (plan === "pro_lifetime") {
        updateData.is_plus_user = true; // Pro tier uses is_plus_user column
      } else if (plan === "plus_subscription") {
        updateData.is_lite_user = true; // Plus tier uses is_lite_user column
        // Set expiry to 3 months from now
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        updateData.lite_expiry = expiryDate.toISOString();
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", userId);

      if (updateError) throw updateError;

      const tierName = plan === "pro_lifetime" ? "Pro" : "Plus";
      return res.status(200).json({
        success: true,
        message: `Payment verified and account upgraded to ${tierName}`,
      });
    } catch (error) {
      console.error("Payment verification/Upgrade error:", error);
      return res
        .status(500)
        .json({ error: "Failed to verify payment or upgrade user" });
    }
  }

  return res.status(404).json({ error: "Subscription action not found" });
}

// ==========================================
// PDF Share Handler (MongoDB Masked URLs)
// ==========================================
async function handlePdfShare(req, res, url) {
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const method = req.method;
  const queryParams = {};
  url.searchParams.forEach((value, key) => (queryParams[key] = value));

  const subAction = queryParams.subAction || req.body?.subAction;

  try {
    const db = await getMongoDb();
    const collection = db.collection("pdf_shares");

    // CREATE / CREATE MASK
    if (
      method === "POST" &&
      (subAction === "create" || url.pathname.includes("/create"))
    ) {
      const { actualUrl } = req.body;
      if (!actualUrl) {
        return res.status(400).json({ error: "actualUrl is required" });
      }

      // 1. Check if mapping already exists
      const existing = await collection.findOne({ actualUrl });
      if (existing) {
        return res.status(200).json({ maskId: existing.maskId, isNew: false });
      }

      // 2. Generate unique maskId
      let maskId;
      let isUnique = false;
      while (!isUnique) {
        maskId = crypto.randomBytes(4).toString("hex"); // 8 char hex
        const duplicate = await collection.findOne({ maskId });
        if (!duplicate) isUnique = true;
      }

      // 3. Insert and return
      await collection.insertOne({
        maskId,
        actualUrl,
        createdAt: new Date(),
      });

      return res.status(201).json({ maskId, isNew: true });
    }

    // RESOLVE / GET ACTUAL URL
    if (
      method === "GET" &&
      (subAction === "resolve" || url.pathname.includes("/resolve"))
    ) {
      const maskId = queryParams.maskId;
      if (!maskId) {
        return res.status(400).json({ error: "maskId is required" });
      }

      const share = await collection.findOne({ maskId });
      if (!share) {
        return res
          .status(404)
          .json({ error: "Shared link not found or expired" });
      }

      return res.status(200).json({ actualUrl: share.actualUrl });
    }

    return res.status(400).json({ error: "Invalid share action" });
  } catch (error) {
    console.error("PDF Share API error:", error);
    return res
      .status(503)
      .json({ error: "Database error", details: error.message });
  }
}

/**
 * Handle Analytics Ingestion (Proxy to Supabase)
 * @param {import('vercel').VercelRequest} req
 * @param {import('vercel').VercelResponse} res
 */
const ANALYTICS_ALLOWED_ORIGIN_HOSTS = new Set([
  "getmaterio.app",
  "www.getmaterio.app",
  "materioa.netlify.app",
  "materioa.vercel.app",
  "materioapp.in",
  "auth-materioa.netlify.app",
  "insightroom.vercel.app",
  "room.getmaterio.app",
]);
const ANALYTICS_MAX_REQUEST_SECONDS = 2 * 60 * 60;
const ANALYTICS_MAX_REQUEST_ENGAGEMENT_SECONDS = 3 * 60 * 60;
const ANALYTICS_MAX_PDF_ENTRIES = 30;
const ANALYTICS_MAX_REQUEST_PDF_OPENS = 30;
const ANALYTICS_MAX_PDF_COUNT_PER_ITEM = 8;
const ANALYTICS_MAX_PDF_SECONDS_PER_ITEM = 2 * 60 * 60;
const ANALYTICS_RATE_WINDOW_MS = 60 * 1000;
const ANALYTICS_RATE_LIMIT_IP = 180;
const ANALYTICS_RATE_LIMIT_ANON = 90;
const ANALYTICS_RATE_LIMIT_USER = 90;
const ANALYTICS_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const analyticsRateBuckets = new Map();
const MODERATION_RULES_COLLECTION = "abuse_moderation_rules";

function clampInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  const normalized = Math.trunc(number);
  return Math.min(Math.max(normalized, min), max);
}

function toTrimmedString(value, maxLength = 255) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeModerationIdentity(value, maxLength = 255) {
  return toTrimmedString(value, maxLength).toLowerCase();
}

function getAnalyticsClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim().slice(0, 64);
  }
  return (
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

async function findActiveModerationRule({ anonId, fingerprint, ipAddress, action = null } = {}) {
  const normalizedAnonId = normalizeModerationIdentity(anonId, 128);
  const normalizedFingerprint = normalizeModerationIdentity(fingerprint, 128);
  const normalizedIp = normalizeModerationIdentity(ipAddress, 64);

  // Require all three identifiers to avoid warning/blocking the wrong user.
  if (!normalizedAnonId || !normalizedFingerprint || !normalizedIp) {
    return null;
  }

  try {
    const db = await getMongoDb();
    const query = {
      active: true,
      anon_id: normalizedAnonId,
      fingerprint: normalizedFingerprint,
      ip_address: normalizedIp,
    };

    if (action) {
      query.action = normalizeModerationIdentity(action, 16);
    }

    const rule = await db.collection(MODERATION_RULES_COLLECTION).findOne(query, {
      sort: { updatedAt: -1, createdAt: -1 },
      projection: {
        _id: 0,
        action: 1,
        title: 1,
        body: 1,
        active: 1,
        updatedAt: 1,
      },
    });

    if (!rule) return null;

    return {
      action: normalizeModerationIdentity(rule.action, 16),
      title: toTrimmedString(rule.title, 120),
      body: toTrimmedString(rule.body, 300),
      active: rule.active !== false,
      updatedAt: rule.updatedAt || null,
    };
  } catch (error) {
    // Moderation checks are best-effort and must not break analytics availability.
    return null;
  }
}

function isAllowedAnalyticsHost(host) {
  if (!host) return false;
  if (ANALYTICS_ALLOWED_ORIGIN_HOSTS.has(host)) return true;
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function resolveHeaderUrlHost(value) {
  const raw = toTrimmedString(value, 512);
  if (!raw) return "";
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return "";
  }
}

function validateAnalyticsRequestOrigin(req) {
  const originHost = resolveHeaderUrlHost(req.headers.origin || req.headers.Origin);
  const refererHost = resolveHeaderUrlHost(
    req.headers.referer || req.headers.referrer,
  );
  const secFetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();

  if (
    secFetchSite &&
    !["same-origin", "same-site", "none"].includes(secFetchSite)
  ) {
    return { ok: false, reason: "Cross-site analytics submission blocked" };
  }

  if (originHost && isAllowedAnalyticsHost(originHost)) {
    return { ok: true };
  }

  if (!originHost && refererHost && isAllowedAnalyticsHost(refererHost)) {
    return { ok: true };
  }

  return { ok: false, reason: "Untrusted analytics request origin" };
}

function consumeAnalyticsRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = analyticsRateBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    analyticsRateBuckets.set(key, { count: 1, windowStart: now, lastSeen: now });
    return { allowed: true };
  }

  bucket.lastSeen = now;
  if (bucket.count >= limit) {
    const retryAfterMs = Math.max(windowMs - (now - bucket.windowStart), 1000);
    return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

function cleanupAnalyticsRateBuckets() {
  const now = Date.now();
  const staleAfter = ANALYTICS_RATE_WINDOW_MS * 10;
  for (const [key, value] of analyticsRateBuckets.entries()) {
    if (!value?.lastSeen || now - value.lastSeen > staleAfter) {
      analyticsRateBuckets.delete(key);
    }
  }
}

function validateAnalyticsDateKey(value) {
  const dateKey = toTrimmedString(value, 32);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const deltaDays = Math.round((parsed.getTime() - todayUtc) / (24 * 60 * 60 * 1000));

  // Allow small client/server timezone skew only.
  if (deltaDays < -2 || deltaDays > 1) {
    return null;
  }

  return dateKey;
}

function sanitizeAnalyticsPdfCounts(rawPdfCounts) {
  if (!rawPdfCounts || typeof rawPdfCounts !== "object" || Array.isArray(rawPdfCounts)) {
    return { ok: true, pdfCounts: {}, totalPdfOpens: 0, uniquePdfReads: 0 };
  }

  const entries = Object.entries(rawPdfCounts).slice(0, ANALYTICS_MAX_PDF_ENTRIES);
  const safeCounts = {};
  let totalPdfOpens = 0;
  let uniquePdfReads = 0;

  for (const [rawName, rawValue] of entries) {
    const name = normalizeAnalyticsPdfName(rawName).slice(0, 120);
    if (!name) continue;

    let count = 0;
    let timeSec = 0;

    if (typeof rawValue === "number") {
      count = clampInteger(rawValue, 0, ANALYTICS_MAX_PDF_COUNT_PER_ITEM);
    } else if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      count = clampInteger(rawValue.count, 0, ANALYTICS_MAX_PDF_COUNT_PER_ITEM);
      timeSec = clampInteger(rawValue.time_sec, 0, ANALYTICS_MAX_PDF_SECONDS_PER_ITEM);
    }

    if (count <= 0 && timeSec <= 0) {
      continue;
    }

    totalPdfOpens += count;
    if (count > 0) uniquePdfReads += 1;

    safeCounts[name] = {
      count,
      time_sec: timeSec,
    };
  }

  if (totalPdfOpens > ANALYTICS_MAX_REQUEST_PDF_OPENS) {
    return { ok: false, error: "Too many PDF opens in a single analytics request" };
  }

  if (uniquePdfReads > totalPdfOpens) {
    return { ok: false, error: "Invalid PDF counters: unique exceeds total" };
  }

  return { ok: true, pdfCounts: safeCounts, totalPdfOpens, uniquePdfReads };
}

function sanitizeAnalyticsPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return { ok: false, error: "Invalid analytics payload" };
  }

  const anonId = toTrimmedString(rawPayload.p_anon_id, 128);
  if (!anonId || !/^[a-zA-Z0-9._:-]{8,128}$/.test(anonId)) {
    return { ok: false, error: "Invalid anonymous analytics identity" };
  }

  const dateKey = validateAnalyticsDateKey(rawPayload.p_date);
  if (!dateKey) {
    return { ok: false, error: "Invalid analytics date" };
  }

  const metricsDiff =
    rawPayload.p_metrics_diff &&
    typeof rawPayload.p_metrics_diff === "object" &&
    !Array.isArray(rawPayload.p_metrics_diff)
      ? rawPayload.p_metrics_diff
      : {};

  const usermetaDiff =
    rawPayload.p_usermeta_diff &&
    typeof rawPayload.p_usermeta_diff === "object" &&
    !Array.isArray(rawPayload.p_usermeta_diff)
      ? rawPayload.p_usermeta_diff
      : {};

  const totalReadingSec = clampInteger(
    metricsDiff.total_reading_sec,
    0,
    ANALYTICS_MAX_REQUEST_SECONDS,
  );
  const totalEngagementSec = clampInteger(
    usermetaDiff.total_engagement_sec,
    0,
    ANALYTICS_MAX_REQUEST_ENGAGEMENT_SECONDS,
  );

  const pdfResult = sanitizeAnalyticsPdfCounts(metricsDiff.pdf_counts || {});
  if (!pdfResult.ok) {
    return { ok: false, error: pdfResult.error };
  }

  const sanitized = {
    p_anon_id: anonId,
    p_date: dateKey,
    p_user_id: null,
    p_metrics_diff: {
      total_reading_sec: totalReadingSec,
      pdf_counts: pdfResult.pdfCounts,
    },
    p_usermeta_diff: {
      total_engagement_sec: totalEngagementSec,
      session:
        usermetaDiff.session &&
        typeof usermetaDiff.session === "object" &&
        !Array.isArray(usermetaDiff.session)
          ? {
              ua: toTrimmedString(usermetaDiff.session.ua, 400),
              screen: toTrimmedString(usermetaDiff.session.screen, 40),
              referrer: toTrimmedString(usermetaDiff.session.referrer, 500),
              url: toTrimmedString(usermetaDiff.session.url, 500),
              path: toTrimmedString(usermetaDiff.session.path, 200),
              campaign: toTrimmedString(usermetaDiff.session.campaign, 100),
              fp: toTrimmedString(usermetaDiff.session.fp, 128),
            }
          : null,
      engagement:
        usermetaDiff.engagement &&
        typeof usermetaDiff.engagement === "object" &&
        !Array.isArray(usermetaDiff.engagement)
          ? usermetaDiff.engagement
          : { clicks: {}, scroll: 0, zoom: 0, shortcuts: {} },
      state:
        usermetaDiff.state &&
        typeof usermetaDiff.state === "object" &&
        !Array.isArray(usermetaDiff.state)
          ? usermetaDiff.state
          : null,
    },
    rawUserId: toTrimmedString(rawPayload.p_user_id, 64) || null,
  };

  return { ok: true, data: sanitized };
}

async function handleAnalytics(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    cleanupAnalyticsRateBuckets();

    const originCheck = validateAnalyticsRequestOrigin(req);
    if (!originCheck.ok) {
      return res.status(403).json({ error: originCheck.reason });
    }

    const parsedPayload = sanitizeAnalyticsPayload(req.body);
    if (!parsedPayload.ok) {
      return res.status(400).json({ error: parsedPayload.error });
    }

    const data = parsedPayload.data;
    const clientIp = getAnalyticsClientIp(req);
    const fingerprint = toTrimmedString(data.p_usermeta_diff?.session?.fp, 128);
    const token = getTokenFromHeaders(req.headers);
    const decoded = token ? verifyToken(token) : null;

    if (token && (!decoded || !decoded.id || !ANALYTICS_UUID_REGEX.test(decoded.id))) {
      return res.status(401).json({ error: "Invalid analytics auth token" });
    }

    if (data.rawUserId && decoded?.id && data.rawUserId !== decoded.id) {
      // Block spoofed user identity writes from unauthenticated or mismatched requests.
      return res.status(403).json({ error: "User identity mismatch in analytics payload" });
    }

    data.p_user_id = decoded?.id || (data.rawUserId && ANALYTICS_UUID_REGEX.test(data.rawUserId) ? data.rawUserId : null);
    delete data.rawUserId;

    const matchedBan = await findActiveModerationRule({
      anonId: data.p_anon_id,
      fingerprint,
      ipAddress: clientIp,
      action: "ban",
    });

    if (matchedBan) {
      return res.status(403).json({
        error: matchedBan.title || "This device has been blocked",
        action: "ban",
      });
    }

    const ipLimit = consumeAnalyticsRateLimit(
      `analytics:ip:${clientIp}`,
      ANALYTICS_RATE_LIMIT_IP,
      ANALYTICS_RATE_WINDOW_MS,
    );
    if (!ipLimit.allowed) {
      res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
      return res.status(429).json({ error: "Too many analytics requests from IP" });
    }

    const anonLimit = consumeAnalyticsRateLimit(
      `analytics:anon:${data.p_anon_id}`,
      ANALYTICS_RATE_LIMIT_ANON,
      ANALYTICS_RATE_WINDOW_MS,
    );
    if (!anonLimit.allowed) {
      res.setHeader("Retry-After", String(anonLimit.retryAfterSec));
      return res.status(429).json({ error: "Too many analytics requests for anonymous identity" });
    }

    if (data.p_user_id) {
      const userLimit = consumeAnalyticsRateLimit(
        `analytics:user:${data.p_user_id}`,
        ANALYTICS_RATE_LIMIT_USER,
        ANALYTICS_RATE_WINDOW_MS,
      );
      if (!userLimit.allowed) {
        res.setHeader("Retry-After", String(userLimit.retryAfterSec));
        return res.status(429).json({ error: "Too many analytics requests for user" });
      }
    }

    // Enrich payload with server-side metadata if not present
    if (data.p_usermeta_diff && data.p_usermeta_diff.session) {
      data.p_usermeta_diff.session.ip = clientIp;
    }

    // Proxy specifically to the atomic merger RPC
    const { error } = await supabaseAdmin.rpc("merge_daily_stats", data);

    if (error) {
      console.error("Supabase Analytics Error:", error);
      return res.status(500).json({ error: "Upstream failure", details: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Analytics Handler Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function normalizeAnalyticsPdfName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPdfCountMap(metrics) {
  if (!metrics || typeof metrics !== "object") {
    return {};
  }
  if (metrics.pdf_counts && typeof metrics.pdf_counts === "object") {
    return metrics.pdf_counts;
  }
  if (metrics.pdfs_read && typeof metrics.pdfs_read === "object") {
    return metrics.pdfs_read;
  }
  return {};
}

function getPdfReadsForName(pdfCountMap, targetPdfName) {
  const normalizedTarget = normalizeAnalyticsPdfName(targetPdfName);
  if (!normalizedTarget) return 0;

  let reads = 0;
  for (const [rawName, value] of Object.entries(pdfCountMap || {})) {
    if (normalizeAnalyticsPdfName(rawName) !== normalizedTarget) {
      continue;
    }

    const countValue =
      typeof value === "number"
        ? value
        : Number(value?.count || 0);
    reads += Number.isFinite(countValue) ? countValue : 0;
  }

  return reads;
}

function getPdfTimeSecForName(pdfCountMap, targetPdfName) {
  const normalizedTarget = normalizeAnalyticsPdfName(targetPdfName);
  if (!normalizedTarget) return 0;

  let seconds = 0;
  for (const [rawName, value] of Object.entries(pdfCountMap || {})) {
    if (normalizeAnalyticsPdfName(rawName) !== normalizedTarget) {
      continue;
    }

    if (typeof value === "number") {
      continue;
    }

    const secValue = Number(value?.time_sec || value?.duration_sec || 0);
    seconds += Number.isFinite(secValue) ? secValue : 0;
  }

  return seconds;
}

async function fetchDailyStatsRows(maxRows = 25000) {
  const batchSize = 1000;
  let from = 0;
  const allRows = [];

  while (from < maxRows) {
    const to = from + batchSize - 1;
    const { data, error } = await supabaseAdmin
      .from("user_daily_stats")
      .select("*")
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  return allRows;
}

function toDateKey(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  return null;
}

function getRowDateKey(row) {
  if (!row || typeof row !== "object") return null;

  const candidates = [
    row.stat_date,
    row.date,
    row.day,
    row.record_date,
    row.created_at,
    row.updated_at,
  ];

  for (const candidate of candidates) {
    const key = toDateKey(candidate);
    if (key) return key;
  }

  return null;
}

function filterRowsByTimeframe(rows, timeframe, requestedDateKey) {
  if (timeframe !== "today" && timeframe !== "weekly") {
    return rows;
  }

  const baseDateStr = toDateKey(requestedDateKey) || new Date().toISOString().slice(0, 10);

  if (timeframe === "today") {
    return (rows || []).filter((row) => getRowDateKey(row) === baseDateStr);
  }

  if (timeframe === "weekly") {
    const baseDate = new Date(baseDateStr + "T00:00:00Z");
    if (Number.isNaN(baseDate.getTime())) return rows;
    
    return (rows || []).filter((row) => {
      const rowDateKey = getRowDateKey(row);
      if (!rowDateKey) return false;
      const rowDate = new Date(rowDateKey + "T00:00:00Z");
      if (Number.isNaN(rowDate.getTime())) return false;
      
      const diffTime = baseDate.getTime() - rowDate.getTime();
      const diffDays = diffTime / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays < 7;
    });
  }

  return rows;
}

function isSuspiciousLeaderboardAggregate(entry, timeframe) {
  if (!entry || typeof entry !== "object") return true;

  const totalReads = Number(entry.totalReads || 0);
  const totalReadSec = Number(entry.totalReadSec || 0);
  const uniquePdfs = Number(entry.uniquePdfs || 0);
  const maxTimeframeReadSec =
    timeframe === "today"
      ? 16 * 60 * 60
      : 7 * 16 * 60 * 60;

  if (!Number.isFinite(totalReads) || totalReads < 0) return true;
  if (!Number.isFinite(totalReadSec) || totalReadSec < 0) return true;
  if (!Number.isFinite(uniquePdfs) || uniquePdfs < 0) return true;
  if (uniquePdfs > totalReads) return true;
  if (totalReadSec > maxTimeframeReadSec) return true;
  return false;
}

async function fetchLeaderboardIdentityMap(readerIds = []) {
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const userIds = Array.from(
    new Set(
      (readerIds || [])
        .map((id) => String(id || "").trim())
        .filter((id) => UUID_REGEX.test(id)),
    ),
  );

  if (!userIds.length) {
    return new Map();
  }

  const identities = new Map();
  const chunkSize = 200;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,display_name,username")
      .in("id", chunk);

    if (error) {
      throw error;
    }

    for (const row of data || []) {
      const id = String(row.id || "").trim();
      if (!id) continue;

      const displayName =
        String(row.display_name || "").trim() ||
        String(row.username || "").trim() ||
        null;

      if (displayName) {
        identities.set(id, displayName);
      }
    }
  }

  return identities;
}

async function handleAnalyticsViews(req, res, url) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const pdfName =
      url.searchParams.get("pdfName") ||
      req.query?.pdfName ||
      "";

    const normalizedPdfName = normalizeAnalyticsPdfName(pdfName);
    if (!normalizedPdfName) {
      return res.status(400).json({ error: "pdfName is required" });
    }

    const rows = await fetchDailyStatsRows();

    let totalReads = 0;
    const readers = new Set();

    for (const row of rows) {
      const countMap = extractPdfCountMap(row.metrics);
      const reads = getPdfReadsForName(countMap, normalizedPdfName);
      if (reads <= 0) continue;

      totalReads += reads;
      const readerId = String(row.user_id || row.anon_id || "").trim();
      if (readerId) {
        readers.add(readerId);
      }
    }

    const uniqueReads = readers.size;
    const hasData = totalReads > 0 && uniqueReads > 0;

    return res.status(200).json({
      pdfName: normalizedPdfName,
      hasData,
      uniqueReads,
      totalReads,
    });
  } catch (error) {
    console.error("Analytics Views Error:", error);
    return res.status(500).json({ error: "Failed to compute PDF views" });
  }
}

async function handleAnalyticsLeaderboard(req, res, url) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const limitRaw = Number(url.searchParams.get("limit") || req.query?.limit || 50);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 3), 50);

    const targetPdfName =
      url.searchParams.get("pdfName") ||
      req.query?.pdfName ||
      "";
    const normalizedTargetPdf = normalizeAnalyticsPdfName(targetPdfName);

    const requesterAnonId = String(
      url.searchParams.get("anonId") || req.query?.anonId || "",
    ).trim();
    const requesterFingerprint = String(
      url.searchParams.get("fp") || req.query?.fp || "",
    ).trim();
    const requesterUserId = String(
      url.searchParams.get("userId") || req.query?.userId || "",
    ).trim();
    const timeframeRaw = String(
      url.searchParams.get("timeframe") || req.query?.timeframe || "weekly",
    )
      .trim()
      .toLowerCase();
    const timeframe = timeframeRaw === "today" ? "today" : "weekly";
    const requestedDateKey = String(
      url.searchParams.get("date") || req.query?.date || "",
    ).trim();

    const rows = filterRowsByTimeframe(
      await fetchDailyStatsRows(),
      timeframe,
      requestedDateKey,
    );
    const byReader = new Map();

    for (const row of rows) {
      const readerKey = String(row.user_id || row.anon_id || "").trim();
      if (!readerKey) continue;

      const current = byReader.get(readerKey) || {
        readerId: readerKey,
        isAnonymous: !row.user_id,
        totalReads: 0,
        totalReadSec: 0,
        uniquePdfSet: new Set(),
      };

      const countMap = extractPdfCountMap(row.metrics);
      if (normalizedTargetPdf) {
        current.totalReads += getPdfReadsForName(countMap, normalizedTargetPdf);
        current.totalReadSec += getPdfTimeSecForName(countMap, normalizedTargetPdf);
      } else {
        for (const [pdfName, value] of Object.entries(countMap || {})) {
          const reads =
            typeof value === "number"
              ? value
              : Number(value?.count || 0);
          const readSec =
            typeof value === "number"
              ? 0
              : Number(value?.time_sec || value?.duration_sec || 0);

          const safeReads = Number.isFinite(reads) ? reads : 0;
          const safeReadSec = Number.isFinite(readSec) ? readSec : 0;

          current.totalReads += safeReads;
          current.totalReadSec += safeReadSec;

          if (safeReads > 0) {
            current.uniquePdfSet.add(normalizeAnalyticsPdfName(pdfName));
          }
        }
      }

      byReader.set(readerKey, current);
    }

    const userIdsInLeaderboard = Array.from(byReader.values())
      .filter((entry) => !entry.isAnonymous)
      .map((entry) => entry.readerId);
    const identityMap = await fetchLeaderboardIdentityMap(userIdsInLeaderboard);

    const ranked = Array.from(byReader.values())
      .filter((entry) => entry.totalReads > 0)
      .map((entry) => ({
        readerId: entry.readerId,
        isAnonymous: entry.isAnonymous,
        totalReads: entry.totalReads,
        totalReadSec: entry.totalReadSec,
        uniquePdfs: entry.uniquePdfSet.size,
      }))
      .filter((entry) => !isSuspiciousLeaderboardAggregate(entry, timeframe))
      .sort((a, b) => {
        if (b.totalReadSec !== a.totalReadSec) return b.totalReadSec - a.totalReadSec;
        if (b.totalReads !== a.totalReads) return b.totalReads - a.totalReads;
        if (b.uniquePdfs !== a.uniquePdfs) return b.uniquePdfs - a.uniquePdfs;
        return a.readerId.localeCompare(b.readerId);
      })
      .map((entry, index) => {
        const readableId = entry.readerId || "reader";
        const maskedId = readableId.slice(-6).padStart(6, "0");
        const resolvedName =
          !entry.isAnonymous && identityMap.has(entry.readerId)
            ? identityMap.get(entry.readerId)
            : null;
        return {
          ...entry,
          rank: index + 1,
          displayName:
            resolvedName ||
            (entry.isAnonymous ? `Anon #${maskedId}` : `Reader #${maskedId}`),
        };
      });

    const requester =
      ranked.find((entry) => {
        if (requesterUserId && entry.readerId === requesterUserId) return true;
        if (requesterAnonId && entry.readerId === requesterAnonId) return true;
        return false;
      }) || null;

    const moderationNotice = await findActiveModerationRule({
      anonId: requesterAnonId,
      fingerprint: requesterFingerprint,
      ipAddress: getAnalyticsClientIp(req),
    });

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      timeframe,
      date: timeframe === "today" ? (toDateKey(requestedDateKey) || new Date().toISOString().slice(0, 10)) : null,
      targetPdf: normalizedTargetPdf || null,
      totalParticipants: ranked.length,
      entries: ranked.slice(0, limit),
      requester: requester
        ? {
            readerId: requester.readerId,
            rank: requester.rank,
            isTopReader: requester.rank === 1,
            isAnonymous: requester.isAnonymous,
          }
        : {
            rank: null,
            isTopReader: false,
            isAnonymous: !requesterUserId,
          },
      moderationNotice: moderationNotice
        ? {
            action: moderationNotice.action,
            title: moderationNotice.title,
            body: moderationNotice.body,
            active: moderationNotice.active,
          }
        : null,
    });
  } catch (error) {
    console.error("Analytics Leaderboard Error:", error);
    return res.status(500).json({ error: "Failed to compute leaderboard" });
  }
}

async function handlePosts(req, res, url) {
  // CORS setup
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");

  try {
    const postsDir = path.join(process.cwd(), "_posts");
    
    // Parse query parameters
    const queryParams = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    
    const queryCategory = (req.query?.category || queryParams.category || "").trim().toLowerCase();
    
    if (!fs.existsSync(postsDir)) {
      return res.status(200).json([]);
    }

    const files = fs.readdirSync(postsDir);
    const posts = [];

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      // Parse date and slug from filename
      const filenameMatch = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
      let dateFromFilename = "";
      let slug = "";
      if (filenameMatch) {
        dateFromFilename = filenameMatch[1];
        slug = filenameMatch[2];
      } else {
        slug = file.replace(/\.md$/, "");
      }

      const filePath = path.join(postsDir, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      
      const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
      const match = fileContent.match(frontmatterRegex);
      
      let frontmatter = {};
      if (match) {
        try {
          frontmatter = yaml.load(match[1]) || {};
        } catch (e) {
          console.error(`Error parsing YAML in ${file}:`, e);
        }
      }

      // Merge filename data and frontmatter
      const postData = {
        slug,
        dateFromFilename,
        ...frontmatter
      };

      // Ensure tags is always an array
      if (postData.tags) {
        if (!Array.isArray(postData.tags)) {
          postData.tags = [postData.tags];
        }
      } else {
        postData.tags = [];
      }

      // Check category filter
      if (queryCategory) {
        let postCategory = postData.category || "";
        let postCategories = Array.isArray(postData.categories)
          ? postData.categories
          : (typeof postData.categories === "string" ? [postData.categories] : []);
        
        if (postCategory) {
          postCategories.push(postCategory);
        }

        const normalizedPostCategories = postCategories.map(cat => String(cat).trim().toLowerCase());
        
        const isMatch = normalizedPostCategories.some(cat => {
          return cat === queryCategory ||
                 cat.replace(/[\s_]+/g, "-") === queryCategory ||
                 cat === queryCategory.replace(/[\s_]+/g, "-");
        });

        if (!isMatch) {
          continue;
        }
      }

      posts.push(postData);
    }

    // Sort posts by date descending
    posts.sort((a, b) => {
      const dateA = new Date(a.date || a.dateFromFilename || 0);
      const dateB = new Date(b.date || b.dateFromFilename || 0);
      return dateB - dateA;
    });

    return res.status(200).json(posts);
  } catch (error) {
    console.error("Error in handlePosts:", error);
    return res.status(500).json({ error: "Failed to load posts", details: error.message });
  }
}

// ==========================================
// PROMOTIONS, RELEASES, AND EXAM DATA FEATURES
// ==========================================

const checkAdminUser = async (req) => {
  const token = getTokenFromHeaders(req.headers) || req.query?.token;
  if (!token) return false;
  const decoded = verifyToken(token);
  if (!decoded) return false;

  const userId = decoded.id || decoded.sub;
  if (!userId) return false;

  const client = supabaseAdmin || supabase;
  const { data: user, error: userError } = await client
    .from('users')
    .select('id, has_admin_privileges')
    .eq('id', userId)
    .single();

  return !userError && user && (user.has_admin_privileges === true || user.hasAdminPrivileges === true);
};

async function handlePromotionsFeature(req, res) {
  try {
    const db = await getMongoDb();
    const promotionsCollection = db.collection('promotions');
    const method = req.method;
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const getAll = url.searchParams.get('all') === 'true' || req.query?.all === 'true' || req.query?.all === true;

    switch (method) {
      case 'GET':
        if (getAll) {
          const isAdminUser = await checkAdminUser(req);
          if (!isAdminUser) {
            return res.status(403).json({ error: 'Admin privileges required' });
          }

          let promos = await promotionsCollection
            .find({})
            .sort({ lastUpdated: -1, _id: -1 })
            .toArray();

          if (promos.length === 0) {
            try {
              const promoFilePath = path.join(process.cwd(), 'assets', 'data', 'promo.json');
              if (fs.existsSync(promoFilePath)) {
                const defaultPromo = JSON.parse(fs.readFileSync(promoFilePath, 'utf8'));
                const inserted = await promotionsCollection.insertOne({
                  ...defaultPromo,
                  lastUpdated: defaultPromo.lastUpdated || new Date().toISOString()
                });
                promos = [{ _id: inserted.insertedId, ...defaultPromo }];
              }
            } catch (e) {
              console.warn('Could not seed promo from fallback file:', e.message);
            }
          }

          return res.status(200).json(promos);
        } else {
          const now = new Date();
          let promos = await promotionsCollection
            .find({ enabled: true })
            .sort({ lastUpdated: -1, _id: -1 })
            .toArray();

          if (promos.length === 0) {
            try {
              const promoFilePath = path.join(process.cwd(), 'assets', 'data', 'promo.json');
              if (fs.existsSync(promoFilePath)) {
                const defaultPromo = JSON.parse(fs.readFileSync(promoFilePath, 'utf8'));
                if (defaultPromo.enabled) {
                  promos = [defaultPromo];
                }
              }
            } catch (e) {}
          }

          const activePromo = promos.find(promo => {
            if (!promo.isLimitedOffer) return true;
            if (!promo.startDate || !promo.endDate) return true;
            
            const start = new Date(promo.startDate);
            const end = new Date(promo.endDate);
            return now >= start && now <= end;
          });

          if (activePromo) {
            return res.status(200).json(activePromo);
          } else {
            return res.status(200).json({ enabled: false });
          }
        }

      case 'POST': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const promoData = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!promoData || !promoData.title || !promoData.description) {
          return res.status(400).json({ error: 'Title and description are required' });
        }

        const newPromo = {
          ...promoData,
          lastUpdated: new Date().toISOString()
        };
        delete newPromo._id;

        if (newPromo.enabled) {
          await promotionsCollection.updateMany(
            {},
            { $set: { enabled: false } }
          );
        }

        const result = await promotionsCollection.insertOne(newPromo);

        // Best effort sync to local promo.json file if possible
        try {
          const sourceFile = path.join(process.cwd(), 'assets', 'data', 'promo.json');
          if (fs.existsSync(path.dirname(sourceFile))) {
            fs.writeFileSync(sourceFile, JSON.stringify(newPromo, null, 2));
          }
        } catch (e) {}

        return res.status(201).json({ 
          message: 'Promotion created successfully', 
          id: result.insertedId,
          promo: { _id: result.insertedId, ...newPromo }
        });
      }

      case 'PUT': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const promoData = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!promoData || !promoData._id) {
          return res.status(400).json({ error: 'Promotion data with _id is required' });
        }

        const id = String(promoData._id);
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: 'Invalid promotion ID' });
        }

        const updateData = { ...promoData };
        delete updateData._id;

        updateData.lastUpdated = new Date().toISOString();

        if (updateData.enabled) {
          await promotionsCollection.updateMany(
            { _id: { $ne: new ObjectId(id) } },
            { $set: { enabled: false } }
          );
        }

        const result = await promotionsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Promotion not found' });
        }

        // Best effort sync to local promo.json file if possible
        try {
          const sourceFile = path.join(process.cwd(), 'assets', 'data', 'promo.json');
          if (fs.existsSync(path.dirname(sourceFile))) {
            fs.writeFileSync(sourceFile, JSON.stringify(updateData, null, 2));
          }
        } catch (e) {}

        return res.status(200).json({ 
          message: 'Promotion updated successfully',
          promo: { _id: id, ...updateData }
        });
      }

      case 'DELETE': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const id = url.searchParams.get('id') || req.query?.id;
        if (!id || !ObjectId.isValid(id)) {
          return res.status(400).json({ error: 'Valid promotion id parameter is required' });
        }

        const result = await promotionsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Promotion not found' });
        }

        return res.status(200).json({ message: 'Promotion deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Promotions Feature Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

const parseBuildDate = (dateStr) => {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};

async function handleReleasesFeature(req, res) {
  try {
    const db = await getMongoDb();
    const releasesCollection = db.collection('releases');
    const method = req.method;
    const url = new URL(req.url, `http://${req.headers.host}`);

    switch (method) {
      case 'GET': {
        const releases = await releasesCollection.find({}).toArray();
        
        releases.sort((a, b) => {
          const dateB = parseBuildDate(b.build);
          const dateA = parseBuildDate(a.build);
          if (dateB.getTime() !== dateA.getTime()) {
            return dateB - dateA;
          }
          return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
        });

        return res.status(200).json(releases);
      }

      case 'POST': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const releaseData = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!releaseData || !releaseData.version || !releaseData.build || !Array.isArray(releaseData.logs)) {
          return res.status(400).json({ error: 'Version, build date, and logs array are required' });
        }

        const newRelease = {
          branch: releaseData.branch || 'stable',
          version: releaseData.version,
          build: releaseData.build,
          logs: releaseData.logs
        };

        const result = await releasesCollection.insertOne(newRelease);
        return res.status(201).json({ 
          message: 'Release created successfully', 
          id: result.insertedId,
          release: { _id: result.insertedId, ...newRelease }
        });
      }

      case 'PUT': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const releaseData = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!releaseData || !releaseData._id) {
          return res.status(400).json({ error: 'Release data with _id is required' });
        }

        const id = releaseData._id;
        const updateData = { ...releaseData };
        delete updateData._id;

        const result = await releasesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Release not found' });
        }

        return res.status(200).json({ 
          message: 'Release updated successfully',
          release: { _id: id, ...updateData }
        });
      }

      case 'DELETE': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const id = url.searchParams.get('id');
        if (!id) {
          return res.status(400).json({ error: 'Release id parameter is required' });
        }

        const result = await releasesCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Release not found' });
        }

        return res.status(200).json({ message: 'Release deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Releases Feature Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleExamdataFeature(req, res) {
  try {
    const db = await getMongoDb();
    const examdataCollection = db.collection('examdata');
    const method = req.method;

    switch (method) {
      case 'GET': {
        const data = await examdataCollection.findOne({ type: 'config' });
        if (data && data.enabled !== false && Array.isArray(data.semesters) && data.semesters.length > 0) {
          return res.status(200).json(data);
        } else {
          const anyData = await examdataCollection.findOne({});
          if (anyData && anyData.enabled !== false && Array.isArray(anyData.semesters) && anyData.semesters.length > 0) {
            return res.status(200).json(anyData);
          }
          // Fallback to static assets/data/examdata.json
          try {
            const fallbackPath = path.join(process.cwd(), 'assets', 'data', 'examdata.json');
            if (fs.existsSync(fallbackPath)) {
              const fileContent = fs.readFileSync(fallbackPath, 'utf8');
              return res.status(200).json(JSON.parse(fileContent));
            }
          } catch (e) {
            console.error('Failed to load static examdata fallback:', e);
          }
          return res.status(200).json({ enabled: false, semesters: [] });
        }
      }

      case 'POST': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
          const form = new formidable.IncomingForm({
            multiples: false,
            keepExtensions: true,
          });

          const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
              if (err) reject(err);
              else resolve([fields, files]);
            });
          });

          const uploadedFile = files.file;
          if (!uploadedFile) {
            return res.status(400).json({ error: 'No file provided' });
          }

          const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;
          const fileContent = fs.readFileSync(file.filepath);
          
          // Determine if it's an image or CSV
          const isCsv = file.originalFilename.toLowerCase().endsWith('.csv');
          const prefix = isCsv ? 'seating' : 'promotions';
          const fileExtension = isCsv ? 'csv' : file.originalFilename.split('.').pop() || 'png';
          const contentTypeHeader = isCsv ? 'text/csv' : (file.mimetype || 'image/png');
          
          const fileName = `${prefix}/${prefix}_data_${Date.now()}.${fileExtension}`;

          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('profile-pictures')
            .upload(fileName, fileContent, {
              contentType: contentTypeHeader,
              upsert: true
            });

          if (uploadError) {
            console.error('Supabase Storage Upload Error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload to storage', details: uploadError.message });
          }

          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('profile-pictures')
            .getPublicUrl(fileName);

          return res.status(200).json({
            message: 'File uploaded successfully',
            url: publicUrl,
            fileName: file.originalFilename
          });
        }

        const examData = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!examData || Object.keys(examData).length === 0) {
          return res.status(400).json({ error: 'Exam configuration data is required' });
        }

        const cleanData = {
          ...examData,
          type: 'config',
          lastUpdated: new Date().toISOString()
        };
        delete cleanData._id;

        const result = await examdataCollection.replaceOne(
          { type: 'config' },
          cleanData,
          { upsert: true }
        );

        return res.status(200).json({
          message: 'Exam configuration saved successfully',
          examdata: cleanData
        });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('ExamData Feature Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleNotificationsFeature(req, res) {
  try {
    const db = await getMongoDb();
    const notificationsCollection = db.collection('notifications');
    const method = req.method;
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    switch (method) {
      case 'GET': {
        let items = await notificationsCollection
          .find({})
          .sort({ timestamp: -1, date: -1, _id: -1 })
          .toArray();

        if (items.length === 0) {
          try {
            const notifFilePath = path.join(process.cwd(), 'notifications.json');
            if (fs.existsSync(notifFilePath)) {
              const fileData = JSON.parse(fs.readFileSync(notifFilePath, 'utf8'));
              items = Array.isArray(fileData) ? fileData : (fileData.notifications || []);
            }
          } catch (e) {}
        }
        return res.status(200).json(items);
      }

      case 'POST': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const data = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!data || !data.title || !data.message) {
          return res.status(400).json({ error: 'Title and message are required' });
        }

        const newNotif = {
          title: data.title.trim(),
          message: data.message.trim(),
          category: data.category ? data.category.trim() : 'General',
          link: data.link ? data.link.trim() : '',
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          created_at: new Date().toISOString()
        };

        const result = await notificationsCollection.insertOne(newNotif);
        newNotif._id = result.insertedId;

        // Try syncing to local notifications.json file if possible
        try {
          const notifFilePath = path.join(process.cwd(), 'notifications.json');
          let existing = [];
          if (fs.existsSync(notifFilePath)) {
            const content = fs.readFileSync(notifFilePath, 'utf8');
            existing = JSON.parse(content);
            if (!Array.isArray(existing)) existing = [];
          }
          existing.unshift(newNotif);
          fs.writeFileSync(notifFilePath, JSON.stringify(existing.slice(0, 100), null, 2));
        } catch (e) {}

        return res.status(201).json({ message: 'Notification created', notification: newNotif });
      }

      case 'PUT': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const data = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (!data || (!data._id && !data.id)) {
          return res.status(400).json({ error: 'Notification ID is required' });
        }

        const id = String(data._id || data.id);
        const updateData = { ...data };
        delete updateData._id;
        delete updateData.id;
        updateData.updated_at = new Date().toISOString();

        if (ObjectId.isValid(id)) {
          await notificationsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
          );
        } else {
          await notificationsCollection.updateOne(
            { id: id },
            { $set: updateData }
          );
        }

        return res.status(200).json({ message: 'Notification updated', notification: { _id: id, ...updateData } });
      }

      case 'DELETE': {
        const isAdminUser = await checkAdminUser(req);
        if (!isAdminUser) {
          return res.status(403).json({ error: 'Admin privileges required' });
        }

        const id = url.searchParams.get('id') || req.query?.id;
        if (!id) {
          return res.status(400).json({ error: 'Notification id parameter is required' });
        }

        if (ObjectId.isValid(id)) {
          await notificationsCollection.deleteOne({ _id: new ObjectId(id) });
        } else {
          await notificationsCollection.deleteOne({ id: id });
        }

        return res.status(200).json({ message: 'Notification deleted' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Notifications Feature Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
