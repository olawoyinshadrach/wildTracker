/* eslint-disable prettier/prettier */

export const LOGINVERIFICATION_QUEUE = 'loginVerificationQueue';
export const OLD_AUTH_TOKEN_QUEUE = 'oldAuthTokenQueue'
export const WELCOME_QUEUE = 'welcomeQueue';

// Export job interfaces for cleanup queues
export interface OldAuthTokenJobData {
  tokenIds: string[];
  cleanupReason: 'TERMINATED' | 'EXPIRED' | 'MANUAL';
  cleanupDate: Date;
}



const LOGO_URL = process.env.WILDTRACKER_LOGO;

export function generateWelcomeTemplate(
  userName?: string,
): string {
  const year = new Date().getFullYear();
  const displayName = userName || 'Wildlife Enthusiast';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Welcome to WildTracker!</title>
<style>
  body {
    background-color: #FAFAFA;
    margin: 0;
    padding: 0;
    font-family: 'Roboto', sans-serif;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0,0,0,0.05);
  }
  .header {
    background: linear-gradient(135deg, #228B22, #4CAF50);
    padding: 30px;
    text-align: center;
  }
  .content {
    padding: 40px;
    text-align: left;
    font-family: 'Roboto', sans-serif;
  }
  .content h2 {
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    font-size: 24px;
    color: #202124;
    margin-bottom: 16px;
  }
  .content p {
    font-size: 16px;
    line-height: 22.4px;
    color: #5c6570;
    margin-bottom: 16px;
  }
  .highlight {
    color: #228B22;
    font-weight: 600;
  }
  .button {
    display: inline-block;
    padding: 12px 24px;
    background-color: #228B22;
    color: white;
    text-decoration: none;
    font-family: 'Poppins', sans-serif;
    font-weight: 500;
    font-size: 16px;
    border-radius: 6px;
    margin-top: 16px;
  }
  .button:hover {
    background-color: #4CAF50;
  }
  .footer {
    background-color: #f9fafb;
    padding: 20px;
    text-align: center;
    font-size: 12px;
    color: #9ca3af;
  }
  .feature-list {
    background-color: #f0f8f0;
    border-left: 4px solid #228B22;
    padding: 16px;
    margin: 20px 0;
    border-radius: 0 8px 8px 0;
  }
  .feature-list li {
    margin-bottom: 8px;
    color: #333333;
  }
</style>
</head>

<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <img src="${LOGO_URL}" width="80" style="display:block;margin:auto;" alt="WildTracker Logo">
    </div>

    <!-- Content -->
    <div class="content">
      <h2>Welcome to WildTracker!</h2>
      <p>Hello ${displayName},</p>
      <p>
        Welcome to <span class="highlight">WildTracker</span> — your smart, ethical way to track, monitor, and support primates in the wild.
      </p>
      <p>
        Whether you're a <strong>Reporter</strong> documenting wildlife sightings or an <strong>Adopter/Responder</strong> helping with rescue efforts, you've just joined a community dedicated to primate conservation and ethical wildlife tracking.
      </p>
      
      <div class="feature-list">
        <p style="margin-top:0; font-family: 'Poppins', sans-serif; font-weight: 600; color: #228B22;">What you can do:</p>
        <ul>
          <li>📸 Capture and report primate sightings with photos</li>
          <li>📍 Track locations using GPS and real-time mapping</li>
          <li>🔔 Receive proximity alerts with haptic feedback</li>
          <li>📹 Stream live video for verification</li>
          <li>💬 Communicate with other wildlife enthusiasts</li>
          <li>🐒 Symbolically adopt and support primates</li>
        </ul>
      </div>
      
      <p>
        Your next step? Start exploring the app, report your first sighting, or browse nearby wildlife activity. Every report helps protect our primate friends!
      </p>
      <p>
        <a href="#" class="button">Start Tracking</a>
      </p>
      <p>Cheers,<br />The WildTracker Team</p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>© ${year} WildTracker - Ethical Primate Tracking & Rescue</p>
      <p style="margin-top:8px; font-size:11px;">Together for wildlife conservation 🌿</p>
    </div>
  </div>
</body>
</html>
`;
}

