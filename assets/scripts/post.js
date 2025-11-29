document.addEventListener('DOMContentLoaded', function () {
  // Inject in-article ads
  injectInArticleAds();

  // Check if this is a private post
  const postContainer = document.querySelector('main[data-visibility="private"]');
  if (postContainer) {
    checkPrivatePostAccess();
  }

  // Check if user is logged in and show summary section if needed
  checkSummaryAccess();

  // Initialize listen component
  initializeListenComponent();

  // Initialize scroll to top button
  initializeScrollToTop();

  // Clear any previous TTS state from other pages
  clearTTSState();

  // Pre-load voices for better TTS performance
  if (window.speechSynthesis) {
    // Trigger voice loading
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', function () {
      console.log('Voices loaded:', speechSynthesis.getVoices().length);
    });

    // Add test TTS button for debugging (temporary)
    console.log('TTS is available. You can test it by running testTTS() in console.');
  } else {
    console.error('Speech synthesis not supported in this browser');
  }

  // Process attachment tags
  processAttachmentTags();

  // Process video tags
  processVideoTags();

  // Initialize video controls for cover video
  setTimeout(() => {
    initializeVideoControls();
  }, 200);

  // Add hover effects to navigation buttons
  const navButtons = document.querySelectorAll('a[title="Previous Post"], a[title="Next Post"]');
  navButtons.forEach(button => {
    button.addEventListener('mouseenter', function () {
      this.style.background = 'var(--primary, #ff8200)';
      this.querySelector('i').style.color = 'white';
    });

    button.addEventListener('mouseleave', function () {
      // Reset to original styles based on dark mode
      if (document.body.classList.contains('dark-mode')) {
        this.style.background = '#444444';
        this.querySelector('i').style.color = '#ffffff';
      } else {
        this.style.background = '#f5f5f5';
        this.querySelector('i').style.color = '#333';
      }
    });
  });
});

function checkSummaryAccess() {
  const token = localStorage.getItem('materio_auth_token');
  const summarySection = document.getElementById('ai-summary-section');

  if (token && summarySection) {
    // Verify user has admin or plus privileges
    fetch('/api/v2/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    })
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to verify user privileges');
      })
      .then(userData => {
        // Show summary section for admin users or plus users
        if (userData.user?.hasAdminPrivileges || userData.user?.isPlusUser) {
          summarySection.style.display = 'block';
        } else {
          summarySection.style.display = 'none';
        }
      })
      .catch(error => {
        console.error('Error checking summary access:', error);
        summarySection.style.display = 'none';
      });
  }
}

function toggleSummary() {
  const content = document.getElementById('ai-summary-content');
  const chevron = document.getElementById('summary-chevron');
  const placeholder = document.getElementById('summary-placeholder');
  const summaryText = document.getElementById('summary-text');

  if (content.style.display === 'none') {
    // Expand and generate summary if not already generated
    content.style.display = 'block';
    chevron.style.transform = 'rotate(180deg)';

    if (summaryText.innerHTML === '') {
      generateSummary();
    }
  } else {
    // Collapse
    content.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
  }
}

async function generateSummary() {
  const placeholder = document.getElementById('summary-placeholder');
  const summaryText = document.getElementById('summary-text');
  const token = localStorage.getItem('materio_auth_token');

  // Show loading state
  placeholder.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Generating summary...';
  placeholder.style.display = 'block';
  summaryText.style.display = 'none';

  try {
    // Get the blog content
    const postBody = document.querySelector('.post-body');
    const blogContent = postBody ? postBody.innerText : '';
    const postTitle = document.querySelector('.post-title') ? document.querySelector('.post-title').innerText : '';

    if (!blogContent) {
      throw new Error('No content found to summarize');
    }

    // Calculate target summary length (keep it very short)
    const wordCount = blogContent.split(/\s+/).length;
    const targetWords = Math.max(30, Math.min(80, Math.floor(wordCount / 6))); // Even shorter: 1/6 instead of 1/4

    // Prepare the optimized summary request
    const summaryPrompt = `Summarize this blog post titled "${postTitle}" in EXACTLY ${targetWords} words or less.

STRICT REQUIREMENTS:
- Maximum ${targetWords} words total
- Focus ONLY on the main point and 2-3 key takeaways
- Use simple, clear language - no fluff
- For tables: briefly explain what the table shows, don't recreate it
- For math: use LaTeX ($inline$ or $$display$$) 
- Use bullet points for multiple points
- NO unnecessary line breaks or spacing
- Be extremely concise but informative

Content to summarize:
${blogContent}

Provide a ultra-concise summary:`;

    const response = await fetch('/api/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: summaryPrompt,
        messages: [],
        mode: 'general',
        model: 'openai/gpt-oss-20b:free'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate summary: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to generate summary');
    }

    // Hide placeholder and show summary with typing animation
    placeholder.style.display = 'none';
    summaryText.style.display = 'block';

    // Type out the summary with animation and render formatting
    await typeWriterEffectWithFormatting(summaryText, data.response);

    // Show follow-up section after summary is complete
    document.getElementById('followup-section').style.display = 'block';

  } catch (error) {
    console.error('Error generating summary:', error);
    placeholder.innerHTML = `<i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem; color: #ff6b6b;"></i>Failed to generate summary. Please try again.`;
  }
}

async function typeWriterEffectWithFormatting(element, text) {
  element.innerHTML = '';

  // Parse markdown and prepare for rendering
  const formattedText = parseBasicMarkdown(text);

  // Create a temporary element to parse the HTML properly
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = formattedText;

  // Extract text content and tags separately for proper typing
  await typeHTMLContent(element, tempDiv);

  // Final LaTeX rendering
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.log('Final LaTeX rendering failed:', e);
    }
  }
}

async function typeHTMLContent(targetElement, sourceElement) {
  const childNodes = sourceElement.childNodes;

  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];

    if (node.nodeType === Node.TEXT_NODE) {
      // Handle text nodes - type character by character
      const text = node.textContent;
      await typeText(targetElement, text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Handle element nodes - create the element and type its content
      const newElement = document.createElement(node.tagName.toLowerCase());

      // Copy attributes
      for (let attr of node.attributes || []) {
        newElement.setAttribute(attr.name, attr.value);
      }

      targetElement.appendChild(newElement);

      // Recursively type the content of this element
      await typeHTMLContent(newElement, node);
    }
  }
}

async function typeText(element, text) {
  const words = text.split(/(\s+)/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Type each character of the word
    for (let j = 0; j < word.length; j++) {
      const currentText = element.textContent || '';
      element.textContent = currentText + word[j];

      // Small delay between characters for smooth typing
      if (j < word.length - 1 || i < words.length - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 25 + 10));
      }
    }

    // Re-render LaTeX occasionally during typing
    if (i % 5 === 0 && window.renderMathInElement) {
      try {
        window.renderMathInElement(element.closest('#ai-summary-content'), {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) {
        // Silently continue if LaTeX rendering fails
      }
    }

    // Scroll to keep the typing text in view occasionally
    if (i % 3 === 0) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function parseBasicMarkdown(text) {
  // Clean up the text first - remove excessive newlines and spaces
  let parsed = text
    .trim()
    // Remove multiple consecutive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing spaces
    .replace(/[ \t]+$/gm, '')
    // Clean up spacing around punctuation
    .replace(/\s+([.,:;!?])/g, '$1');

  // Preserve LaTeX expressions first with unique markers
  const latexExpressions = [];
  parsed = parsed
    .replace(/\$\$([^$]+)\$\$/g, (match, content) => {
      const id = `__LATEX_DISPLAY_${latexExpressions.length}__`;
      latexExpressions.push({ id, content: `$$${content}$$`, type: 'display' });
      return id;
    })
    .replace(/\$([^$]+)\$/g, (match, content) => {
      const id = `__LATEX_INLINE_${latexExpressions.length}__`;
      latexExpressions.push({ id, content: `$${content}$`, type: 'inline' });
      return id;
    });

  // Convert markdown formatting (be more careful with spacing)
  parsed = parsed
    // Bold and italic
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')

    // Headers (only if at start of line)
    .replace(/^### ([^\n]+)$/gm, '<h3>$1</h3>')
    .replace(/^## ([^\n]+)$/gm, '<h2>$1</h2>')
    .replace(/^# ([^\n]+)$/gm, '<h1>$1</h1>')

    // Lists (handle properly)
    .replace(/^[\s]*[\*\-\+] (.+)$/gm, '<li>$1</li>')
    .replace(/^[\s]*(\d+)\. (.+)$/gm, '<li>$2</li>')

    // Table detection and explanation
    .replace(/\|.*\|.*\n[\|\-\s]+\n(\|.*\|.*\n)*/g, '<div class="table-summary"><em>📊 Table showing data relationships and values</em></div>')

    // Convert double newlines to paragraph breaks, single newlines to spaces
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, ' ')

    // Clean up extra spaces
    .replace(/\s+/g, ' ');

  // Wrap content in paragraphs if needed
  if (!parsed.startsWith('<')) {
    parsed = '<p>' + parsed + '</p>';
  }

  // Clean up list formatting
  parsed = parsed
    .replace(/(<li>.*?<\/li>)/gs, (match) => '<ul>' + match + '</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/<p>\s*<ul>/g, '<ul>')
    .replace(/<\/ul>\s*<\/p>/g, '</ul>');

  // Clean up paragraph formatting
  parsed = parsed
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<p>\s*<h/g, '<h')
    .replace(/<\/h[1-6]>\s*<\/p>/g, (match) => match.replace('</p>', ''))
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><');

  // Restore LaTeX expressions
  latexExpressions.forEach(({ id, content }) => {
    parsed = parsed.replace(id, content);
  });

  return parsed.trim();
}

function handleFollowupKeypress(event) {
  if (event.key === 'Enter') {
    askFollowupQuestion();
  }
}

async function askFollowupQuestion() {
  const input = document.getElementById('followup-input');
  const responseDiv = document.getElementById('followup-response');
  const button = document.getElementById('followup-btn');
  const token = localStorage.getItem('materio_auth_token');

  const question = input.value.trim();
  if (!question) return;

  // Show loading state
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size: 12px;"></i>';
  button.disabled = true;
  input.disabled = true;

  responseDiv.style.display = 'block';
  responseDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Thinking...';

  try {
    // Get the blog content for context
    const postBody = document.querySelector('.post-body');
    const blogContent = postBody ? postBody.innerText : '';
    const postTitle = document.querySelector('.post-title') ? document.querySelector('.post-title').innerText : '';

    if (!blogContent) {
      throw new Error('No content found to reference');
    }

    // Prepare the followup question prompt
    const followupPrompt = `Based on the blog post titled "${postTitle}", please answer this question briefly and clearly:

Question: ${question}

Post content for reference:
${blogContent}

REQUIREMENTS:
- Answer in 30-50 words maximum
- Base your answer ONLY on the content provided
- If the question cannot be answered from the post, say so
- Be direct and helpful
- Use simple, clear language

Answer:`;

    const response = await fetch('/api/v2/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: followupPrompt,
        messages: [],
        mode: 'general',
        model: 'openai/gpt-oss-20b:free'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get answer: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get answer');
    }

    // Clear input and show response with typing effect
    input.value = '';
    await typeFollowupResponse(responseDiv, data.response);

  } catch (error) {
    console.error('Error getting followup answer:', error);
    responseDiv.innerHTML = `<i class="fa-solid fa-exclamation-triangle" style="margin-right: 0.5rem; color: #ff6b6b;"></i>Could not get an answer. Please try again.`;
  } finally {
    // Reset button state
    button.innerHTML = '<i class="fa-solid fa-arrow-up" style="font-size: 12px; transform: rotate(45deg);"></i>';
    button.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

async function typeFollowupResponse(element, text) {
  element.innerHTML = '';

  // Clean and format the response
  const cleanText = text.trim().replace(/\s+/g, ' ');

  // Type character by character for smooth effect
  for (let i = 0; i < cleanText.length; i++) {
    element.textContent += cleanText[i];

    // Small delay between characters
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));
  }

  // Render LaTeX if present
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch (e) {
      // Silently continue if LaTeX rendering fails
    }
  }
}

async function checkPrivatePostAccess() {
  const token = localStorage.getItem('materio_auth_token');
  // console.log('Post access check - Token found:', !!token);

  if (!token) {
    // console.log('No token found, showing access denied');
    showAccessDenied();
    return;
  }

  try {
    // console.log('Making request to profile endpoint for post access...');
    const response = await fetch('/api/v2/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    });

    // console.log('Post access - Profile response status:', response.status);

    if (response.ok) {
      const userData = await response.json();
      // console.log('Post access - User data:', userData);
      // console.log('Post access - Has admin privileges:', userData.user?.hasAdminPrivileges);

      if (!userData.user?.hasAdminPrivileges && !userData.user?.isPlusUser) {
        // console.log('User does not have admin privileges or plus access, showing access denied');
        showAccessDenied();
      } else {
        // console.log('User has admin privileges or plus access, allowing access');
      }
    } else {
      const errorData = await response.text();
      // console.log('Post access - Profile request failed:', response.status, errorData);
      showAccessDenied();
    }
  } catch (error) {
    console.error('Error checking post access:', error);
    showAccessDenied();
  }
}

function showAccessDenied() {
  const postContainer = document.querySelector('.post-container');
  postContainer.innerHTML = `
   <div style="text-align: center; padding: 2rem; max-width: 500px; margin: 0 auto;">
  <h1 style="color: #ff8759; margin-bottom: 1rem;">
    <i class="fa-solid fa-lock"></i> Uh-oh! This Page is Off-limits 
  </h1>
  <p style="font-size: 1.1rem; margin-bottom: 1.5rem;">
    This Post is only available to Plus and Super users.
  </p>
  <p style="color: var(--gray); margin-bottom: 2rem;">
     Please log in with your Plus or Super account to view this content.
  </p>
  <a href="/account" style="background: #ff8200; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600;">
    Log In
  </a>
</div>

  `;
}

// Share post function
function sharePost() {
  gtag('event', 'share', {
    method: 'button',
    event_category: 'engagement',
    event_label: 'Share Post'
  });

  // Get post title with fallback options
  const h1Element = document.querySelector('h1');
  const postTitle = h1Element ? h1Element.textContent : (document.title || 'Blog Post');
  const postUrl = window.location.href;

  console.log('Share function called with title:', postTitle, 'and URL:', postUrl);

  // Check if Web Share API is supported
  if (navigator.share) {
    console.log('Using Web Share API');
    navigator.share({
      title: postTitle,
      url: postUrl,
      text: 'Check out this blog post:'
    }).catch((error) => {
      console.log('Web Share API error:', error);
      fallbackShare(postUrl, postTitle);
    });
  } else {
    console.log('Web Share API not supported, using fallback');
    fallbackShare(postUrl, postTitle);
  }
}

// Fallback share function for browsers without Web Share API
function fallbackShare(url, title) {
  console.log('Using fallback share method');

  // Copy URL to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      console.log('URL copied to clipboard successfully');
      showShareSuccess();
    }).catch((error) => {
      console.log('Clipboard API failed:', error);
      showSharePrompt(url);
    });
  } else {
    console.log('Clipboard API not supported');
    showSharePrompt(url);
  }
}

// Show success feedback
function showShareSuccess() {
  const shareIcon = document.querySelector('.fa-share');
  if (shareIcon) {
    const originalClass = shareIcon.className;
    shareIcon.className = 'fa-solid fa-check';
    shareIcon.style.color = '#28a745';

    setTimeout(() => {
      shareIcon.className = originalClass;
      shareIcon.style.color = 'var(--text)';
    }, 2000);
  }
}

// Show prompt as final fallback
function showSharePrompt(url) {
  try {
    prompt('Copy this link to share:', url);
  } catch (error) {
    console.log('Prompt failed:', error);
  }
}

// Print post function
function printPost() {
  gtag('event', 'printables_made', {
    method: 'button',
    event_category: 'engagement',
    event_label: 'Print Post'
  });

  console.log('Printable Created!');

  // Force generate print elements before printing
  if (window.generatePrintElements) {
    console.log('Manually calling generatePrintElements');
    window.generatePrintElements();

    // Force style recalculation
    const printHeader = document.querySelector('.print-page-header');
    if (printHeader) {
      console.log('Forcing style recalculation');
      printHeader.offsetHeight; // Force reflow
    }
  }

  // Increase delay to ensure CSS is fully processed
  setTimeout(() => {
    console.log('Opening print dialog');
    window.print();
  }, 150);
}

function processAttachmentTags() {
  // Find all attachment tags in the post content
  const postBody = document.querySelector('.post-body');
  if (!postBody) {
    console.log('No post body found');
    return;
  }

  console.log('Processing attachments in:', postBody.innerHTML.substring(0, 200));

  // Look for custom attachment tags like: [attachment:/path/to/file.pdf:Display Name]
  // Updated to accept URLs (which may contain colons, e.g. http://)
  // Capture everything up to the last colon as the file path, and after it as the display name
  const attachmentPattern = /\[attachment:(.+):([^\]]+)\]/g;
  let content = postBody.innerHTML;
  let match;
  let replacements = 0;

  while ((match = attachmentPattern.exec(content)) !== null) {
    const [fullMatch, filePath, displayName] = match;
    console.log('Found attachment:', filePath, displayName);
    const attachmentHTML = createAttachmentCard(filePath, displayName);
    content = content.replace(fullMatch, attachmentHTML);
    replacements++;
  }

  console.log('Made', replacements, 'attachment replacements');

  if (replacements > 0) {
    postBody.innerHTML = content;

    // Initialize all attachment cards after rendering
    setTimeout(() => {
      initializeAttachmentCards();
    }, 100);
  }
}

// Process video tags in post content
function processVideoTags() {
  const postBody = document.querySelector('.post-body');
  if (!postBody) return;

  console.log('Processing video tags in:', postBody.innerHTML.substring(0, 100));

  let videoReplacements = 0;

  // Process video tags: [video:path] or [video:path:cover]
  postBody.innerHTML = postBody.innerHTML.replace(/\[video:([^\]]+)\]/g, function (match, params) {
    const parts = params.split(':');
    const videoPath = parts[0].trim();
    const isCover = parts[1] && parts[1].trim() === 'cover';

    console.log('Processing video:', videoPath, 'isCover:', isCover);

    const videoId = 'video-' + Math.random().toString(36).substr(2, 9);
    const coverClass = isCover ? 'video-cover' : 'video-embed';

    // Determine video type from file extension
    const fileExtension = videoPath.split('.').pop().toLowerCase();
    let videoType = 'video/mp4'; // default

    if (fileExtension === 'webm') {
      videoType = 'video/webm';
    } else if (fileExtension === 'mov') {
      videoType = 'video/quicktime';
    } else if (fileExtension === 'avi') {
      videoType = 'video/x-msvideo';
    } else if (fileExtension === 'mkv') {
      videoType = 'video/x-matroska';
    }

    videoReplacements++;

    return `
      <div class="${coverClass}">
        <video id="${videoId}" muted loop>
          <source src="${videoPath}" type="${videoType}">
          Your browser does not support the video tag.
        </video>
        <div class="video-controls paused" onclick="toggleVideo('${videoId}')">
          <i class="fa-solid fa-play"></i>
        </div>
      </div>
    `;
  });

  console.log('Made', videoReplacements, 'video replacements');

  // Initialize video controls after processing
  if (videoReplacements > 0) {
    setTimeout(() => {
      initializeVideoControls();
    }, 100);
  }
}

// Toggle video play/pause
function toggleVideo(videoId) {
  const video = document.getElementById(videoId);
  const controls = video.parentElement.querySelector('.video-controls');
  const icon = controls.querySelector('i');

  if (video.paused) {
    video.play().catch(e => console.log('Video play failed:', e));
    icon.className = 'fa-solid fa-pause';
    controls.classList.remove('paused');
    controls.classList.add('playing');
  } else {
    video.pause();
    icon.className = 'fa-solid fa-play';
    controls.classList.remove('playing');
    controls.classList.add('paused');
  }
}

// Initialize video controls and event listeners
function initializeVideoControls() {
  document.querySelectorAll('.video-embed video, .video-cover video').forEach(video => {
    // Remove existing listeners to prevent duplicates
    video.replaceWith(video.cloneNode(true));
    const newVideo = document.getElementById(video.id);

    newVideo.addEventListener('ended', function () {
      const controls = this.parentElement.querySelector('.video-controls');
      const icon = controls.querySelector('i');

      icon.className = 'fa-solid fa-play';
      controls.classList.remove('playing');
      controls.classList.add('paused');
    });

    newVideo.addEventListener('click', function () {
      const videoId = this.id;
      toggleVideo(videoId);
    });

    // Pause other videos when this one starts playing
    newVideo.addEventListener('play', function () {
      document.querySelectorAll('.video-embed video, .video-cover video').forEach(otherVideo => {
        if (otherVideo !== this && !otherVideo.paused) {
          toggleVideo(otherVideo.id);
        }
      });
    });
  });
}

function createAttachmentCard(filePath, displayName) {
  const fileExtension = filePath.split('.').pop().toLowerCase();
  const fileName = filePath.split('/').pop();
  const attachmentId = 'attachment-' + Math.random().toString(36).substr(2, 9);

  return `
    <div class="attachment-card" data-file-path="${filePath}" data-attachment-id="${attachmentId}">
      <div class="attachment-details">
        <div class="attachment-title">${displayName}</div>
        <div class="attachment-meta">
          <span class="file-type">${fileExtension.toUpperCase()}</span> • 
          <span class="file-size">Click to view</span>
        </div>
      </div>
      <div class="attachment-preview">
        <canvas id="canvas-${attachmentId}" width="100" height="130"></canvas>
        <img id="img-${attachmentId}" style="display: none;" />
      </div>
    </div>
  `;
}

function initializeAttachmentCards() {
  const attachmentCards = document.querySelectorAll('.attachment-card');

  attachmentCards.forEach(async (card) => {
    const filePath = card.getAttribute('data-file-path');
    const attachmentId = card.getAttribute('data-attachment-id');

    // Add click handler to open file
    card.addEventListener('click', () => {
      openAttachment(filePath);
    });

    // Generate preview
    await generateAttachmentPreview(filePath, attachmentId);
  });
}

async function generateAttachmentPreview(filePath, attachmentId) {
  const canvas = document.getElementById(`canvas-${attachmentId}`);
  const img = document.getElementById(`img-${attachmentId}`);
  const ctx = canvas.getContext('2d');
  const fileExtension = filePath.split('.').pop().toLowerCase();

  try {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
      // Handle image files
      generateImagePreview(filePath, canvas, img);
    } else if (fileExtension === 'pdf') {
      // Handle PDF files
      await generatePDFPreview(filePath, canvas);
    } else if (['doc', 'docx', 'txt', 'rtf'].includes(fileExtension)) {
      // Handle document files
      generateDocumentPreview(fileExtension, canvas, ctx);
    } else {
      // Handle other file types
      generateGenericPreview(fileExtension, canvas, ctx);
    }
  } catch (error) {
    console.error('Error generating preview:', error);
    generateGenericPreview(fileExtension, canvas, ctx);
  }
}

function generateImagePreview(filePath, canvas, img) {
  img.src = filePath;
  img.onload = function () {
    const ctx = canvas.getContext('2d');
    canvas.width = 100;
    canvas.height = 130;

    // Calculate aspect ratio and draw image
    const aspectRatio = img.width / img.height;
    let drawWidth = 100;
    let drawHeight = 100 / aspectRatio;

    if (drawHeight > 130) {
      drawHeight = 130;
      drawWidth = 130 * aspectRatio;
    }

    const x = (100 - drawWidth) / 2;
    const y = (130 - drawHeight) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 100, 130);
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
  };

  img.onerror = function () {
    generateGenericPreview('IMG', canvas, canvas.getContext('2d'));
  };
}

async function generatePDFPreview(filePath, canvas) {
  try {
    const pdf = await pdfjsLib.getDocument(filePath).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.4 });
    const ctx = canvas.getContext('2d');

    canvas.width = 100;
    canvas.height = 130;

    // Scale viewport to fit canvas
    const scale = Math.min(100 / viewport.width, 130 / viewport.height);
    const scaledViewport = page.getViewport({ scale: scale });

    await page.render({
      canvasContext: ctx,
      viewport: scaledViewport
    }).promise;
  } catch (error) {
    console.error('PDF preview error:', error);
    generateGenericPreview('PDF', canvas, canvas.getContext('2d'));
  }
}

function generateDocumentPreview(fileExtension, canvas, ctx) {
  canvas.width = 100;
  canvas.height = 130;

  // Document-like background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 100, 130);

  // Add lines to simulate document content
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  for (let i = 20; i < 120; i += 8) {
    ctx.beginPath();
    ctx.moveTo(10, i);
    ctx.lineTo(90, i);
    ctx.stroke();
  }

  // Add file type icon
  ctx.fillStyle = "#4285f4";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(fileExtension.toUpperCase(), 50, 110);

  // Add document icon
  ctx.fillStyle = "#666";
  ctx.font = "16px Arial";
  ctx.fillText("📄", 50, 25);
}

function generateGenericPreview(fileExtension, canvas, ctx) {
  canvas.width = 100;
  canvas.height = 130;

  // Generic file background
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, 100, 130);

  // Border
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 100, 130);

  // File icon
  ctx.fillStyle = "#666";
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("📎", 50, 45);

  // File extension
  ctx.fillStyle = "#333";
  ctx.font = "bold 14px Arial";
  ctx.fillText(fileExtension.toUpperCase(), 50, 70);

  // Generic text
  ctx.fillStyle = "#888";
  ctx.font = "10px Arial";
  ctx.fillText("File", 50, 90);
}

function openAttachment(filePath) {
  // Add analytics tracking
  if (window.gtag) {
    gtag('event', 'attachment_opened', {
      event_category: 'engagement',
      event_label: filePath
    });
  }

  // Open in new tab
  window.open(filePath, '_blank');
}

// Function to inject in-article ads
function injectInArticleAds() {
  // Check if user is Plus or Super user (should get ad-free experience)
  const userData = localStorage.getItem('materio_user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user.isPlusUser || user.hasAdminPrivileges) {
        // Plus/Super users get ad-free experience
        return;
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }

  // Check post category - exclude ads for certain categories
  const postContainer = document.querySelector('.post-container');
  const postCategory = postContainer ? postContainer.getAttribute('data-category') : null;

  // List of categories that should not show ads
  const excludedCategories = ['Announcement', 'What\'s New', 'Legal'];

  // Don't show ads if no category or if category is in excluded list
  if (!postCategory || excludedCategories.includes(postCategory)) {
    return;
  }

  const postBody = document.querySelector('.post-body');
  if (!postBody) return;

  // Get only actual paragraph content (p tags) to avoid inserting ads near headings at the top
  const paragraphs = postBody.querySelectorAll('p');
  if (paragraphs.length < 5) return; // Need at least 5 paragraphs before showing ads

  // Filter out very short paragraphs (likely captions or metadata)
  const substantialParagraphs = Array.from(paragraphs).filter(p => {
    const text = p.textContent.trim();
    return text.length > 50; // Only consider paragraphs with meaningful content
  });

  if (substantialParagraphs.length < 5) return; // Need at least 5 substantial paragraphs

  // Calculate positions to insert ads - start after 5th paragraph, then every 5 paragraphs
  const adPositions = [];
  for (let i = 5; i < substantialParagraphs.length; i += 5) {
    adPositions.push(i);
  }

  // Create and insert ad units at calculated positions
  adPositions.forEach((position, index) => {
    const adContainer = document.createElement('div');
    adContainer.className = 'inarticle-ad-container';
    adContainer.style.margin = '2rem 0';

    // Create the ad ins element
    const adIns = document.createElement('ins');
    adIns.className = 'adsbygoogle';
    adIns.style.display = 'block';
    adIns.style.textAlign = 'center';
    adIns.setAttribute('data-ad-layout', 'in-article');
    adIns.setAttribute('data-ad-format', 'fluid');
    adIns.setAttribute('data-ad-client', 'ca-pub-7539227284131407');
    adIns.setAttribute('data-ad-slot', '7061358716');

    adContainer.appendChild(adIns);

    // Insert after the target paragraph
    const targetParagraph = substantialParagraphs[position];
    if (targetParagraph && targetParagraph.parentNode) {
      targetParagraph.parentNode.insertBefore(adContainer, targetParagraph.nextSibling);
    }
  });

  // Initialize AdSense after injecting ads
  setTimeout(() => {
    const adsToLoad = document.querySelectorAll('.inarticle-ad-container .adsbygoogle');
    adsToLoad.forEach(ad => {
      try {
        (adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error('Error loading ad:', e);
      }
    });
  }, 100);
}

// Simple TTS test function
function testTTS() {
  console.log('Testing TTS...');
  if (!window.speechSynthesis) {
    console.error('Speech synthesis not supported');
    return;
  }

  const testUtterance = new SpeechSynthesisUtterance('Hello, this is a test of text to speech functionality.');
  testUtterance.onstart = () => console.log('Test TTS started');
  testUtterance.onend = () => console.log('Test TTS ended');
  testUtterance.onerror = (e) => console.error('Test TTS error:', e);

  speechSynthesis.speak(testUtterance);
}

// Text-to-Speech functionality
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let isPlaying = false;
let isPaused = false;
let currentText = '';
let startTime = 0;
let pausedTime = 0;
let totalDuration = 0;
let waveformInterval = null;
let currentPostUrl = window.location.href; // Track current post

function initializeListenComponent() {
  // Check if we're on a different post and clear any previous state
  if (currentPostUrl !== window.location.href) {
    console.log('Different post detected, clearing TTS state');
    clearTTSState();
    currentPostUrl = window.location.href;
  }

  // Calculate estimated duration based on word count
  const postBody = document.querySelector('.post-body');
  if (postBody) {
    const wordCount = postBody.innerText.split(/\s+/).length;
    const estimatedMinutes = Math.ceil(wordCount / 120); // Average speaking rate: 120 words per minute for TTS
    totalDuration = estimatedMinutes * 60; // Convert to seconds
    document.getElementById('listen-duration').textContent = `${estimatedMinutes}m audio`;
  }

  // Initialize realistic waveform
  initializeWaveform();
}

function clearTTSState() {
  // Stop any ongoing speech
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }

  // Reset all state variables
  currentUtterance = null;
  isPlaying = false;
  isPaused = false;
  currentText = '';
  startTime = 0;
  pausedTime = 0;

  // Reset chunked playback state
  isChunkedPlayback = false;
  currentChunks = [];
  currentChunkIndex = 0;

  // Stop waveform animation
  stopWaveform();

  // Reset UI
  const listenComponent = document.getElementById('listen-component');
  const listenIcon = document.getElementById('listen-icon');
  const listenDuration = document.getElementById('listen-duration');
  const seekControls = document.getElementById('seek-controls');

  if (listenComponent) listenComponent.classList.remove('playing');
  if (listenIcon) listenIcon.className = 'fa-solid fa-play';
  if (seekControls) seekControls.style.display = 'none';

  console.log('TTS state cleared');
}

function initializeWaveform() {
  const waveBars = document.querySelectorAll('.wave-bar');

  // Create more realistic waveform pattern
  const waveformPattern = [8, 12, 6, 14, 10, 16, 9, 11, 7, 13, 5, 15, 8, 12, 6];

  waveBars.forEach((bar, index) => {
    const height = waveformPattern[index % waveformPattern.length];
    bar.style.height = `${height}px`;
    bar.style.animationDelay = `${index * 0.1}s`;
  });
}

function animateWaveform() {
  const waveBars = document.querySelectorAll('.wave-bar');

  waveformInterval = setInterval(() => {
    waveBars.forEach((bar) => {
      const randomHeight = Math.floor(Math.random() * 10) + 6; // 6-15px
      bar.style.height = `${randomHeight}px`;
    });
  }, 200);
}

function stopWaveform() {
  if (waveformInterval) {
    clearInterval(waveformInterval);
    waveformInterval = null;
    console.log('Waveform animation stopped');
  }

  // Reset to initial pattern
  const waveBars = document.querySelectorAll('.wave-bar');
  if (waveBars.length > 0) {
    initializeWaveform();
  }
}

function toggleListen() {
  console.log('toggleListen called, isPlaying:', isPlaying, 'isPaused:', isPaused);

  // Clear any previous TTS state if on different post
  if (currentPostUrl !== window.location.href) {
    clearTTSState();
    currentPostUrl = window.location.href;
  }

  const listenComponent = document.getElementById('listen-component');
  const listenIcon = document.getElementById('listen-icon');
  const listenDuration = document.getElementById('listen-duration');
  const seekControls = document.getElementById('seek-controls');

  if (window.gtag) {
    gtag('event', 'listen_post', {
      event_category: 'engagement',
      event_label: isPlaying ? 'pause' : 'play'
    });
  }

  if (isPlaying) {
    console.log('Pausing audio...');
    // Pause
    if (isChunkedPlayback) {
      // For chunked playback, we stop the current chunk and remember position
      speechSynthesis.cancel();
    } else {
      speechSynthesis.pause();
    }
    isPlaying = false;
    isPaused = true;
    pausedTime = Date.now() - startTime;
    listenComponent.classList.remove('playing');
    listenIcon.className = 'fa-solid fa-play';
    stopWaveform();
  } else if (isPaused) {
    console.log('Resuming audio...');
    // Resume
    if (isChunkedPlayback) {
      // For chunked playback, continue from current chunk
      isPlaying = true;
      isPaused = false;
      startTime = Date.now() - pausedTime;
      listenComponent.classList.add('playing');
      listenIcon.className = 'fa-solid fa-pause';
      animateWaveform();
      speakNextChunk();
    } else {
      speechSynthesis.resume();
      isPlaying = true;
      isPaused = false;
      startTime = Date.now() - pausedTime;
      listenComponent.classList.add('playing');
      listenIcon.className = 'fa-solid fa-pause';
      animateWaveform();
    }
  } else {
    console.log('Starting new audio...');
    // Start from beginning - clear any previous state first
    clearTTSState();
    startTextToSpeech();
  }
}

function startTextToSpeech() {
  const postBody = document.querySelector('.post-body');
  const postTitle = document.querySelector('.post-title');
  const listenComponent = document.getElementById('listen-component');
  const listenIcon = document.getElementById('listen-icon');
  const listenDuration = document.getElementById('listen-duration');
  const seekControls = document.getElementById('seek-controls');

  if (!postBody) {
    alert('No content found to read');
    return;
  }

  // Get clean text content
  let textToRead = '';
  if (postTitle) {
    textToRead += postTitle.innerText + '. ';
  }

  // Extract text more simply and reliably
  const bodyText = postBody.innerText || postBody.textContent || '';
  textToRead += bodyText
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:()\-'"]/g, '')
    .trim();

  console.log('Text to read length:', textToRead.length);
  console.log('First 100 chars:', textToRead.substring(0, 100));

  if (textToRead.length < 5) {
    alert('No readable content found. Text length: ' + textToRead.length);
    return;
  }

  // Limit text length to avoid browser limits
  if (textToRead.length > 32000) {
    textToRead = textToRead.substring(0, 32000) + '...';
    console.log('Text truncated to 32000 characters');
  }

  currentText = textToRead;
  startTime = Date.now();
  pausedTime = 0;

  speakText(textToRead);
}

function speakText(text) {
  const listenComponent = document.getElementById('listen-component');
  const listenIcon = document.getElementById('listen-icon');
  const listenDuration = document.getElementById('listen-duration');
  const seekControls = document.getElementById('seek-controls');

  // Check if speech synthesis is available
  if (!window.speechSynthesis) {
    alert('Text-to-speech not supported in this browser');
    return;
  }

  // Detect Android and implement chunking for long text
  const isAndroid = /Android/i.test(navigator.userAgent);
  const maxChunkSize = isAndroid ? 4000 : 32000; // Smaller chunks for Android

  console.log('Platform:', isAndroid ? 'Android' : 'Other', 'Max chunk size:', maxChunkSize);

  // If text is too long, use chunking approach
  if (text.length > maxChunkSize) {
    console.log('Text too long, using chunking approach');
    speakTextInChunks(text, maxChunkSize);
    return;
  }

  // Create speech utterance for shorter text
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = 0.9;
  currentUtterance.pitch = 1;
  currentUtterance.volume = 0.8;

  // Function to set voice and speak
  function setVoiceAndSpeak() {
    const voices = speechSynthesis.getVoices();
    console.log('Available voices:', voices.length);

    if (voices.length > 0) {
      // Try to find a good English voice
      const preferredVoice = voices.find(voice =>
        voice.lang.startsWith('en') &&
        (voice.name.includes('Natural') || voice.name.includes('Enhanced') || voice.name.includes('Premium'))
      ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];

      if (preferredVoice) {
        currentUtterance.voice = preferredVoice;
        console.log('Using voice:', preferredVoice.name);
      }
    }

    // Event handlers
    currentUtterance.onstart = function () {
      console.log('Speech onstart event fired');
      isPlaying = true;
      isPaused = false;
      listenComponent.classList.add('playing');
      listenIcon.className = 'fa-solid fa-pause';
      seekControls.style.display = 'flex';
      animateWaveform();
      updateProgress();
    };

    currentUtterance.onend = function () {
      console.log('Speech onend event fired');
      stopAudio();
    };

    currentUtterance.onerror = function (event) {
      console.error('Speech synthesis error:', event);
      console.error('Error details:', event.error, event.type);

      // Handle "interrupted" error more gracefully - it's normal when stopping
      if (event.error === 'interrupted') {
        console.log('Speech was interrupted (normal when stopping)');
        // Don't show alert for interrupted error, just clean up
        stopAudioCleanly();
      } else if (event.error === 'synthesis-failed' && isAndroid) {
        console.log('Android synthesis failed, trying chunked approach');
        // Try chunking on Android if synthesis fails
        setTimeout(() => {
          speakTextInChunks(text, 2000); // Even smaller chunks
        }, 100);
      } else {
        alert('Error playing audio: ' + event.error);
        stopAudio();
      }
    };

    currentUtterance.onpause = function () {
      console.log('Speech onpause event fired');
    };

    currentUtterance.onresume = function () {
      console.log('Speech onresume event fired');
    };

    // Start speaking with platform-specific delay
    try {
      console.log('Starting speech synthesis...');

      // Longer delay for Android to initialize properly
      const delay = isAndroid ? 300 : 100;
      setTimeout(() => {
        speechSynthesis.speak(currentUtterance);

        // Immediately update UI to show loading state
        listenComponent.classList.add('playing');
        listenIcon.className = 'fa-solid fa-pause';
        seekControls.style.display = 'flex';
        animateWaveform();
        isPlaying = true;
      }, delay);

      // Additional check after a delay - Android needs more time
      setTimeout(() => {
        console.log('Speech synthesis speaking state:', speechSynthesis.speaking);
        console.log('Speech synthesis pending state:', speechSynthesis.pending);
        console.log('Speech synthesis paused state:', speechSynthesis.paused);

        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          console.warn('Speech synthesis not speaking after timeout - trying chunked approach');
          if (isAndroid) {
            // For Android, immediately try chunking
            speechSynthesis.cancel();
            setTimeout(() => {
              speakTextInChunks(text, 2000);
            }, 200);
          } else {
            // For other platforms, try shorter text
            speechSynthesis.cancel();
            const shortText = text.substring(0, 500) + '...';
            const simpleUtterance = new SpeechSynthesisUtterance(shortText);
            simpleUtterance.onstart = () => console.log('Short text started speaking');
            simpleUtterance.onerror = (e) => console.error('Short text error:', e);
            speechSynthesis.speak(simpleUtterance);
          }
        }
      }, isAndroid ? 2000 : 1000);

    } catch (error) {
      console.error('Error starting speech:', error);
      alert('Failed to start audio playback');
      stopAudio();
    }
  }

  // Wait for voices to load if needed
  if (speechSynthesis.getVoices().length === 0) {
    console.log('Waiting for voices to load...');
    speechSynthesis.addEventListener('voiceschanged', setVoiceAndSpeak, { once: true });
    // Longer fallback timeout for Android
    setTimeout(setVoiceAndSpeak, isAndroid ? 2000 : 1000);
  } else {
    setVoiceAndSpeak();
  }
}

// New chunking function for Android TTS limitations
let currentChunks = [];
let currentChunkIndex = 0;
let isChunkedPlayback = false;

function speakTextInChunks(text, maxChunkSize) {
  console.log('Starting chunked playback for Android');

  const listenComponent = document.getElementById('listen-component');
  const listenIcon = document.getElementById('listen-icon');
  const seekControls = document.getElementById('seek-controls');

  // Split text into sentences and then group into chunks
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  currentChunks = [];
  let currentChunk = '';

  for (let sentence of sentences) {
    sentence = sentence.trim() + '.';

    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += ' ' + sentence;
    } else {
      if (currentChunk.trim()) {
        currentChunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  }

  // Add the last chunk
  if (currentChunk.trim()) {
    currentChunks.push(currentChunk.trim());
  }

  console.log(`Split into ${currentChunks.length} chunks`);

  currentChunkIndex = 0;
  isChunkedPlayback = true;

  // Update UI
  isPlaying = true;
  isPaused = false;
  listenComponent.classList.add('playing');
  listenIcon.className = 'fa-solid fa-pause';
  seekControls.style.display = 'flex';
  animateWaveform();
  updateProgress();

  speakNextChunk();
}

function speakNextChunk() {
  if (!isChunkedPlayback || currentChunkIndex >= currentChunks.length) {
    console.log('Chunked playback finished');
    stopAudio();
    return;
  }

  const chunk = currentChunks[currentChunkIndex];
  console.log(`Speaking chunk ${currentChunkIndex + 1}/${currentChunks.length}`);

  currentUtterance = new SpeechSynthesisUtterance(chunk);
  currentUtterance.rate = 0.9;
  currentUtterance.pitch = 1;
  currentUtterance.volume = 0.8;

  // Set voice if available
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    const preferredVoice = voices.find(voice =>
      voice.lang.startsWith('en') &&
      (voice.name.includes('Natural') || voice.name.includes('Enhanced') || voice.name.includes('Premium'))
    ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];

    if (preferredVoice) {
      currentUtterance.voice = preferredVoice;
    }
  }

  currentUtterance.onend = function () {
    console.log(`Chunk ${currentChunkIndex + 1} finished`);
    currentChunkIndex++;

    // Small delay between chunks to prevent Android issues
    setTimeout(() => {
      if (isChunkedPlayback && isPlaying && !isPaused) {
        speakNextChunk();
      }
    }, 100);
  };

  currentUtterance.onerror = function (event) {
    console.error('Chunk speech error:', event);
    if (event.error === 'interrupted') {
      return; // Normal when stopping
    }

    console.log('Error in chunk, trying to continue...');
    currentChunkIndex++;
    setTimeout(() => {
      if (isChunkedPlayback && isPlaying && !isPaused) {
        speakNextChunk();
      }
    }, 500);
  };

  try {
    speechSynthesis.speak(currentUtterance);
  } catch (error) {
    console.error('Error speaking chunk:', error);
    currentChunkIndex++;
    setTimeout(() => {
      if (isChunkedPlayback && isPlaying && !isPaused) {
        speakNextChunk();
      }
    }, 500);
  }
}
console.log('Waiting for voices to load...');
function updateProgress() {
  if (!isPlaying && !isPaused) return;

  const listenDuration = document.getElementById('listen-duration');

  const progressInterval = setInterval(() => {
    if (!isPlaying && !isPaused) {
      clearInterval(progressInterval);
      return;
    }

    if (isPlaying) {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      listenDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

function seekBackward() {
  if (!currentText) return;

  // Stop current speech
  speechSynthesis.cancel();

  // Calculate approximate position in text (rough estimation)
  const elapsedTime = isPaused ? pausedTime : (Date.now() - startTime);
  const textProgress = Math.max(0, (elapsedTime / 1000 - 5) / totalDuration); // Go back 5 seconds

  // Find approximate text position
  const targetPosition = Math.floor(currentText.length * textProgress);
  const sentences = currentText.split(/[.!?]+/);

  let charCount = 0;
  let targetSentenceIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    charCount += sentences[i].length + 1; // +1 for punctuation
    if (charCount >= targetPosition) {
      targetSentenceIndex = Math.max(0, i);
      break;
    }
  }

  // Create new text from target position
  const newText = sentences.slice(targetSentenceIndex).join('. ');

  if (newText.trim()) {
    // Update timing
    const seekTime = Math.max(0, elapsedTime - 5000); // Go back 5 seconds
    startTime = Date.now() - seekTime;
    if (isPaused) {
      pausedTime = seekTime;
    }

    setTimeout(() => {
      speakText(newText);
      if (isPaused) {
        setTimeout(() => {
          speechSynthesis.pause();
        }, 100);
      }
    }, 100);
  }
}

function seekForward() {
  if (!currentText) return;

  // Stop current speech
  speechSynthesis.cancel();

  // Calculate approximate position in text
  const elapsedTime = isPaused ? pausedTime : (Date.now() - startTime);
  const textProgress = Math.min(1, (elapsedTime / 1000 + 5) / totalDuration); // Go forward 5 seconds

  // Find approximate text position
  const targetPosition = Math.floor(currentText.length * textProgress);
  const sentences = currentText.split(/[.!?]+/);

  let charCount = 0;
  let targetSentenceIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    charCount += sentences[i].length + 1;
    if (charCount >= targetPosition) {
      targetSentenceIndex = Math.min(sentences.length - 1, i);
      break;
    }
  }

  // Create new text from target position
  const newText = sentences.slice(targetSentenceIndex).join('. ');

  if (newText.trim()) {
    // Update timing
    const seekTime = elapsedTime + 5000; // Go forward 5 seconds
    startTime = Date.now() - seekTime;
    if (isPaused) {
      pausedTime = seekTime;
    }

    setTimeout(() => {
      speakText(newText);
      if (isPaused) {
        setTimeout(() => {
          speechSynthesis.pause();
        }, 100);
      }
    }, 100);
  } else {
    // End of content
    stopAudio();
  }
}

function stopAudio() {
  console.log('stopAudio called');
  speechSynthesis.cancel();

  // Reset chunked playback state
  isChunkedPlayback = false;
  currentChunks = [];
  currentChunkIndex = 0;

  stopAudioCleanly();
}

function stopAudioCleanly() {
  console.log('stopAudioCleanly called');
  isPlaying = false;
  isPaused = false;
  startTime = 0;
  pausedTime = 0;

  const listenComponent = document.getElementById('listen-component');
  const listenIcon = document.getElementById('listen-icon');
  const listenDuration = document.getElementById('listen-duration');
  const seekControls = document.getElementById('seek-controls');

  if (listenComponent) listenComponent.classList.remove('playing');
  if (listenIcon) listenIcon.className = 'fa-solid fa-play';
  if (listenDuration) listenDuration.textContent = calculateDuration();
  if (seekControls) seekControls.style.display = 'none';

  stopWaveform();
  console.log('Audio stopped cleanly');
}

function calculateDuration() {
  const postBody = document.querySelector('.post-body');
  if (postBody) {
    const wordCount = postBody.innerText.split(/\s+/).length;
    const estimatedMinutes = Math.ceil(wordCount / 120); // 120 words per minute for TTS
    return `${estimatedMinutes}m audio`;
  }
  return 'Listen';
}

// Handle visibility change to pause when tab is not active
document.addEventListener('visibilitychange', function () {
  if (document.hidden && isPlaying) {
    speechSynthesis.pause();
  } else if (!document.hidden && isPlaying) {
    speechSynthesis.resume();
  }
});

// Handle page navigation to clear TTS state
window.addEventListener('beforeunload', function () {
  console.log('Page unloading, clearing TTS state');
  clearTTSState();
});

// Handle back/forward navigation
window.addEventListener('popstate', function () {
  console.log('Navigation detected, clearing TTS state');
  clearTTSState();
});

document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    gtag('event', 'printables_made', {
      method: 'keypress',
      event_category: 'engagement',
      event_label: 'Keyboard Print'
    });
  }
});

// Scroll to top button functionality
function initializeScrollToTop() {
  // Create scroll to top button
  const scrollBtn = document.createElement('button');
  scrollBtn.id = 'scroll-to-top';
  scrollBtn.setAttribute('aria-label', 'Scroll to top');
  scrollBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
  document.body.appendChild(scrollBtn);
  
  console.log('Scroll to top button created and added to body');

  // Show/hide button based on scroll position
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  });

  // Scroll to top on button click
  scrollBtn.addEventListener('click', function() {
    const scrollDuration = 1200; // Duration in milliseconds
    const scrollStep = -window.scrollY / (scrollDuration / 15);
    
    const scrollInterval = setInterval(function() {
      if (window.scrollY !== 0) {
        window.scrollBy(0, scrollStep);
      } else {
        clearInterval(scrollInterval);
      }
    }, 15);
  });
}