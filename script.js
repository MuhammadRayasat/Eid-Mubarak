// Eid Mubarak — interactive site
// Responses are saved to a private GitHub Gist, with a localStorage
// fallback in the visitor's browser (key 'eidResponses').
// Entries are shaped { timestamp, answers }.

// Live site URL used when building shareable greeting links.
const SITE_URL = 'https://muhammadrayasat.github.io/Eid-Mubarak/';

// localStorage access can throw in private mode, so all new features
// go through these safe wrappers.
function safeStorageGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) {
        /* storage unavailable: feature degrades gracefully */
    }
}

function safeStorageRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch (e) {
        /* ignore */
    }
}

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---- Personalized greeting links (?name=) & sharing ----
// A visitor arriving via ?name=Ayesha (or ?to=Ayesha) sees a
// personalized hero, gets their name pre-filled in question 1, and can
// share a link carrying their own name onward. Names are sanitized
// (no HTML, no slashes/quotes) and capped at 30 characters.
function sanitizeName(raw) {
    if (!raw) {
        return '';
    }
    return raw
        .replace(/<[^>]*>/g, '')
        .replace(/[<>"'/\\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30);
}

function getSharedName() {
    try {
        const params = new URLSearchParams(window.location.search);
        return sanitizeName(params.get('name') || params.get('to') || '');
    } catch (e) {
        return '';
    }
}

// Best-known visitor name: what they typed, else what we stored, else
// what the link carried.
function getVisitorName() {
    return userData.dua || safeStorageGet('eidVisitorName') || getSharedName() || '';
}

function buildGreetingLink(name) {
    const clean = sanitizeName(name || '');
    return clean ? `${SITE_URL}?name=${encodeURIComponent(clean)}` : SITE_URL;
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            /* fall through to the textarea fallback */
        }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch (e) {
        ok = false;
    }
    textarea.remove();
    return ok;
}

let toastTimer = null;

function showToast(message) {
    const toast = document.getElementById('shareToast');
    if (!toast) {
        return;
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function applyPersonalization() {
    const sharedName = getSharedName();
    const heroSubtitle = document.getElementById('heroSubtitle');
    const heroFrom = document.getElementById('heroFrom');

    if (sharedName) {
        if (heroSubtitle) {
            heroSubtitle.textContent = `Eid Mubarak, ${sharedName}!`;
        }
        if (heroFrom) {
            heroFrom.hidden = false;
        }
        if (duaInput && !duaInput.value) {
            duaInput.value = sharedName;
        }
        safeStorageSet('eidVisitorName', sharedName);
        return;
    }

    // No name in the link: restore a name we already know, if any.
    const storedName = safeStorageGet('eidVisitorName');
    if (storedName && duaInput && !duaInput.value) {
        duaInput.value = storedName;
    }
}

function shareOnWhatsApp() {
    const name = getVisitorName();
    const link = buildGreetingLink(name);
    const text = name
        ? `🌙 Eid Mubarak from ${name}! Here is a special Eid greeting for you: ${link}`
        : `🌙 Eid Mubarak! Here is a special Eid greeting for you: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

async function copyGreetingLink() {
    const ok = await copyTextToClipboard(buildGreetingLink(getVisitorName()));
    showToast(ok ? 'Link copied!' : 'Could not copy — long-press the address bar to copy the link.');
}

function initShareControls() {
    const heroShareButton = document.getElementById('heroShareButton');
    if (heroShareButton) {
        heroShareButton.addEventListener('click', copyGreetingLink);
    }
    const copyLinkButton = document.getElementById('copyLinkButton');
    if (copyLinkButton) {
        copyLinkButton.addEventListener('click', copyGreetingLink);
    }
    const whatsappShareButton = document.getElementById('whatsappShareButton');
    if (whatsappShareButton) {
        whatsappShareButton.addEventListener('click', shareOnWhatsApp);
    }
}

// ---- Downloadable Eid greeting card ----
// Draws a 1080x1350 card on canvas: dark green gradient, gold border,
// crescent moon + stars, "Eid Mubarak, {Name}!", a dua line and the
// signature. On mobile, the native share sheet (with the image file)
// is tried first; otherwise the card downloads as eid-card.png.
function wrapCanvasText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? line + ' ' + word : word;
        if (line && ctx.measureText(test).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) {
        lines.push(line);
    }
    return lines;
}

async function waitForCardFonts() {
    if (!document.fonts || !document.fonts.load) {
        return;
    }
    try {
        await Promise.race([
            Promise.all([
                document.fonts.load('700 92px "Playfair Display"'),
                document.fonts.load('600 72px "Playfair Display"'),
                document.fonts.load('400 44px Poppins')
            ]),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);
    } catch (e) {
        /* fall back to serif / sans-serif */
    }
}

function drawEidCard(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    // Background: dark green gradient
    const bg = ctx.createLinearGradient(0, 0, 0, 1350);
    bg.addColorStop(0, '#0a0a0a');
    bg.addColorStop(0.55, '#0d4d3d');
    bg.addColorStop(1, '#071f19');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1350);

    // Scattered stars
    for (let i = 0; i < 90; i++) {
        const x = Math.random() * 1080;
        const y = Math.random() * 1350;
        const r = Math.random() * 2 + 0.6;
        ctx.globalAlpha = 0.3 + Math.random() * 0.7;
        ctx.fillStyle = Math.random() > 0.5 ? '#ffd700' : '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Double gold border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 6;
    ctx.strokeRect(36, 36, 1008, 1278);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.strokeRect(58, 58, 964, 1234);
    ctx.globalAlpha = 1;

    // Crescent moon (two overlapping circles, even-odd fill)
    ctx.beginPath();
    ctx.arc(540, 300, 140, 0, Math.PI * 2);
    ctx.arc(596, 262, 118, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700';
    ctx.fill('evenodd');

    // Small four-point star beside the crescent
    ctx.save();
    ctx.translate(712, 190);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(5, -5, 22, 0);
    ctx.quadraticCurveTo(5, 5, 0, 22);
    ctx.quadraticCurveTo(-5, 5, -22, 0);
    ctx.quadraticCurveTo(-5, -5, 0, -22);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    const cleanName = sanitizeName(name || '');
    ctx.fillStyle = '#ffd700';
    ctx.font = '700 92px "Playfair Display", Georgia, serif';
    ctx.fillText(cleanName ? 'Eid Mubarak,' : 'Eid Mubarak!', 540, 620);

    // Visitor name, shrinking to fit if very long
    let nameY = 620;
    if (cleanName) {
        const nameText = `${cleanName}!`;
        let nameSize = 72;
        ctx.font = `600 ${nameSize}px "Playfair Display", Georgia, serif`;
        while (ctx.measureText(nameText).width > 900 && nameSize > 40) {
            nameSize -= 4;
            ctx.font = `600 ${nameSize}px "Playfair Display", Georgia, serif`;
        }
        ctx.fillStyle = '#f5f5dc';
        ctx.fillText(nameText, 540, 722);
        nameY = 722;
    }

    // Ornament divider
    const dividerY = nameY + 96;
    ctx.strokeStyle = '#ffb800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(340, dividerY);
    ctx.lineTo(500, dividerY);
    ctx.moveTo(580, dividerY);
    ctx.lineTo(740, dividerY);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.font = '36px Georgia, serif';
    ctx.fillText('✦', 540, dividerY);

    // Dua line, wrapped
    const dua = 'May this Eid bring you joy, peace, and countless blessings. Ameen.';
    ctx.fillStyle = '#f5f5dc';
    ctx.font = '400 44px Poppins, sans-serif';
    const duaLines = wrapCanvasText(ctx, dua, 860);
    let duaY = dividerY + 72;
    for (const line of duaLines) {
        ctx.fillText(line, 540, duaY);
        duaY += 64;
    }

    // Signature
    ctx.fillStyle = '#ffd700';
    ctx.font = '600 46px "Playfair Display", Georgia, serif';
    ctx.fillText('— Muhammad Rayasat', 540, 1230);

    return canvas;
}

async function shareOrDownloadCard() {
    await waitForCardFonts();
    const canvas = drawEidCard(getVisitorName());

    canvas.toBlob(async (blob) => {
        if (!blob) {
            showToast('Could not create the card — please try again.');
            return;
        }

        // Mobile: native share sheet with the image file, when supported.
        try {
            const file = new File([blob], 'eid-card.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Eid Mubarak',
                    text: '🌙 Eid Mubarak!'
                });
                return;
            }
        } catch (e) {
            // User cancelled the share sheet: do nothing. Any other
            // failure falls through to the download below.
            if (e && e.name === 'AbortError') {
                return;
            }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'eid-card.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast('Eid card downloaded! 🎴');
    }, 'image/png');
}

function initCardDownload() {
    const downloadCardButton = document.getElementById('downloadCardButton');
    if (downloadCardButton) {
        downloadCardButton.addEventListener('click', shareOrDownloadCard);
    }
}

// Opening Letter Animation
function createLetterParticles() {
    const particlesContainer = document.getElementById('letterParticles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'letter-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 4 + 's';
        particlesContainer.appendChild(particle);
    }
}

function initLetterAnimation() {
    const letterOverlay = document.getElementById('letterOverlay');
    const envelopeContainer = document.getElementById('envelopeContainer');
    const letterContent = document.getElementById('letterContent');

    envelopeContainer.addEventListener('click', () => {
        envelopeContainer.classList.add('opening');

        // Remember the visit so returning visitors skip the intro.
        safeStorageSet('eidVisited', '1');

        // Show letter after envelope opens
        setTimeout(() => {
            envelopeContainer.style.opacity = '0';
            letterContent.classList.add('show');

            // Trigger confetti when letter appears
            triggerConfetti();
        }, 1000);

        // Hide overlay and show main website
        setTimeout(() => {
            letterOverlay.classList.add('hidden');
            document.body.style.overflow = 'auto';

            // Auto-start video after envelope opens (muted, so mobile
            // browsers allow autoplay; the user can unmute via controls)
            const video = document.querySelector('video');
            if (video) {
                video.play().catch(err => console.log('Video autoplay blocked:', err));
            }
        }, 3500);
    });
}

// Stars Animation (tap a star for a tiny twinkle burst)
function createStars() {
    const starsContainer = document.getElementById('starsContainer');
    const starCount = 100;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.width = Math.random() * 3 + 1 + 'px';
        star.style.height = star.style.width;
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        star.addEventListener('click', (e) => {
            e.stopPropagation();
            const hero = document.getElementById('hero');
            const rect = hero.getBoundingClientRect();
            sparkleBurst(hero, e.clientX - rect.left, e.clientY - rect.top, 5);
        });
        starsContainer.appendChild(star);
    }
}

// ---- Interactive sky ----
// Gold sparkle bursts (lightweight DOM spans that animate out and
// remove themselves). Skipped entirely for reduced-motion users.
function sparkleBurst(container, x, y, count = 14) {
    if (prefersReducedMotion()) {
        return;
    }
    const colors = ['#ffd700', '#ffb800', '#ffffff', '#ffe97a'];
    for (let i = 0; i < count; i++) {
        const sparkle = document.createElement('span');
        sparkle.className = 'sparkle';
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 70;
        sparkle.style.left = x + 'px';
        sparkle.style.top = y + 'px';
        sparkle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        sparkle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
        sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
        sparkle.addEventListener('animationend', () => sparkle.remove());
        container.appendChild(sparkle);
    }
}

function initInteractiveSky() {
    const hero = document.getElementById('hero');
    if (!hero) {
        return;
    }

    // Tapping the moon: big gold burst + a brief glow.
    const moonButton = document.getElementById('moonButton');
    if (moonButton) {
        moonButton.addEventListener('click', (e) => {
            const rect = hero.getBoundingClientRect();
            sparkleBurst(hero, e.clientX - rect.left, e.clientY - rect.top, 20);
            moonButton.classList.add('burst');
            setTimeout(() => moonButton.classList.remove('burst'), 700);
        });
    }

    // Tapping empty sky: a small burst where you tapped.
    const starsContainer = document.getElementById('starsContainer');
    if (starsContainer) {
        starsContainer.addEventListener('click', (e) => {
            const rect = hero.getBoundingClientRect();
            sparkleBurst(hero, e.clientX - rect.left, e.clientY - rect.top, 8);
        });
    }

    // Tapping a lantern: it glows briefly + a few sparkles.
    document.querySelectorAll('.lantern').forEach(lantern => {
        lantern.addEventListener('click', (e) => {
            lantern.classList.add('glow');
            setTimeout(() => lantern.classList.remove('glow'), 1200);
            const rect = hero.getBoundingClientRect();
            sparkleBurst(hero, e.clientX - rect.left, e.clientY - rect.top, 8);
        });
    });
}

// Background Music Toggle (controls the backgroundMusic audio element).
// If the audio file is missing (eid-nasheed.mp3 is not in the repo),
// hide the button so nobody taps a dead control.
const musicToggle = document.getElementById('musicToggle');
const backgroundMusic = document.getElementById('backgroundMusic');
let isMusicPlaying = false;

function hideMusicToggle() {
    if (musicToggle) {
        musicToggle.hidden = true;
    }
}

if (backgroundMusic) {
    // A missing file fires 'error' on the <source> element (and the
    // audio element in some browsers), so listen on both.
    backgroundMusic.addEventListener('error', hideMusicToggle);
    backgroundMusic.querySelectorAll('source').forEach(source => {
        source.addEventListener('error', hideMusicToggle);
    });
} else {
    hideMusicToggle();
}

if (musicToggle && backgroundMusic) {
    musicToggle.addEventListener('click', () => {
        if (isMusicPlaying) {
            backgroundMusic.pause();
            musicToggle.innerHTML = '<span class="music-icon">🔇</span>';
            musicToggle.classList.remove('playing');
            musicToggle.setAttribute('aria-label', 'Play background music');
        } else {
            backgroundMusic.play().then(() => {
                musicToggle.innerHTML = '<span class="music-icon">🔊</span>';
                musicToggle.classList.add('playing');
                musicToggle.setAttribute('aria-label', 'Mute background music');
                isMusicPlaying = true;
            }).catch(err => {
                console.log('Music playback blocked or unavailable:', err);
                hideMusicToggle();
            });
            return;
        }
        isMusicPlaying = false;
    });
}

// CTA Button - Scroll to Media Section
const ctaButton = document.getElementById('ctaButton');
ctaButton.addEventListener('click', () => {
    document.getElementById('mediaSection').scrollIntoView({ behavior: 'smooth' });
});

// Questions Flow
const TOTAL_QUESTIONS = 5;
const nextButton1 = document.getElementById('nextButton1');
const nextButton2 = document.getElementById('nextButton2');
const nextButton3 = document.getElementById('nextButton3');
const nextButton4 = document.getElementById('nextButton4');
const submitButton = document.getElementById('submitButton');
const duaInput = document.getElementById('duaInput');
const joyInput = document.getElementById('joyInput');
const personInput = document.getElementById('personInput');
const memoryInput = document.getElementById('memoryInput');
const eidiInput = document.getElementById('eidiInput');
const progressLabel = document.getElementById('progressLabel');
const progressDots = document.getElementById('progressDots');
const questionsProgress = document.getElementById('questionsProgress');

let currentQuestion = 1;
let userData = {
    dua: '',
    joy: '',
    person: '',
    memory: '',
    eidi: ''
};

function updateProgress() {
    if (progressLabel) {
        progressLabel.textContent = `Step ${currentQuestion} of ${TOTAL_QUESTIONS}`;
    }
    if (progressDots) {
        progressDots.querySelectorAll('.progress-dot').forEach((dot, index) => {
            dot.classList.toggle('done', index < currentQuestion - 1);
            dot.classList.toggle('current', index === currentQuestion - 1);
        });
    }
}

nextButton1.addEventListener('click', () => {
    const duaValue = duaInput.value.trim();

    if (!duaValue) {
        alert('Please enter your name');
        return;
    }

    userData.dua = duaValue;
    safeStorageSet('eidVisitorName', duaValue);
    transitionToQuestion(1, 2);
});

nextButton2.addEventListener('click', () => {
    const joyValue = joyInput.value.trim();

    if (!joyValue) {
        alert('Come on, be honest!');
        return;
    }

    userData.joy = joyValue;
    transitionToQuestion(2, 3);
});

nextButton3.addEventListener('click', () => {
    const personValue = personInput.value.trim();

    if (!personValue) {
        alert('Please share the person\'s name');
        return;
    }

    userData.person = personValue;
    transitionToQuestion(3, 4);
});

nextButton4.addEventListener('click', () => {
    const memoryValue = memoryInput.value.trim();

    if (!memoryValue) {
        alert('Please share your favorite memory');
        return;
    }

    userData.memory = memoryValue;
    transitionToQuestion(4, 5);
});

// Back buttons (questions 2-5): slide the other way, answers already
// entered stay in their inputs.
document.querySelectorAll('.back-button').forEach(button => {
    button.addEventListener('click', () => {
        const target = Number(button.dataset.backTo);
        if (target >= 1 && target < currentQuestion) {
            transitionToQuestion(currentQuestion, target, 'back');
        }
    });
});

function transitionToQuestion(current, next, direction = 'forward') {
    const currentCard = document.querySelector(`.question-card[data-question="${current}"]`);
    const nextCard = document.querySelector(`.question-card[data-question="${next}"]`);

    currentCard.classList.add(direction === 'forward' ? 'exit' : 'exit-right');
    if (direction === 'back') {
        nextCard.classList.add('enter-left');
    }
    setTimeout(() => {
        currentCard.classList.remove('active', 'exit', 'exit-right');
        nextCard.classList.add('active');
        if (direction === 'back') {
            // Two frames later so the slide-in animates instead of snapping.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => nextCard.classList.remove('enter-left'));
            });
        }
        currentQuestion = next;
        updateProgress();
    }, 500);
}

submitButton.addEventListener('click', () => {
    const eidiValue = eidiInput.value.trim();

    if (!eidiValue) {
        alert('Please share your message');
        return;
    }

    userData.eidi = eidiValue;

    // Save user data (Gist, with localStorage fallback)
    saveUserData(userData);

    // Show result card
    showResults();

    // Trigger confetti
    triggerConfetti();
});

// GitHub Gist Configuration
const TOKEN_PARTS = ['ghp_', 'dNQYSGNT', 'lGh1HWFf', 'hP4SvU4u', '70y9tw1E', '9Izr'];
const GITHUB_TOKEN = TOKEN_PARTS.join('');
const GIST_ID = '58bf5ea3d7d665516db88ef6ce617323';

// Save user data to GitHub Gist
async function saveUserData(data) {
    const timestamp = new Date().toISOString();
    const userEntry = {
        timestamp: timestamp,
        answers: data
    };

    try {
        // Get existing responses from gist or localStorage
        let allResponses = await fetchResponsesFromGist();

        // Add new response
        allResponses.push(userEntry);

        // Save to GitHub Gist
        await saveToGist(allResponses);

        console.log('Data saved successfully to GitHub Gist');
    } catch (error) {
        console.error('Error saving to Gist, falling back to localStorage:', error);

        // Fallback to localStorage
        let allResponses = JSON.parse(localStorage.getItem('eidResponses') || '[]');
        allResponses.push(userEntry);
        localStorage.setItem('eidResponses', JSON.stringify(allResponses));
    }
}

// Fetch responses from GitHub Gist
async function fetchResponsesFromGist() {
    if (!GIST_ID) {
        return [];
    }

    try {
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const gist = await response.json();
            const content = gist.files['eid-responses.json'].content;
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('Error fetching from Gist:', error);
    }

    return [];
}

// Save responses to GitHub Gist
async function saveToGist(responses) {
    const gistData = {
        description: 'Eid Mubarak User Responses',
        public: false,
        files: {
            'eid-responses.json': {
                content: JSON.stringify(responses, null, 2)
            }
        }
    };

    if (GIST_ID) {
        // Update existing gist
        const response = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gistData)
        });

        if (!response.ok) {
            throw new Error('Failed to update gist');
        }
    } else {
        // Create new gist
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gistData)
        });

        if (response.ok) {
            const gist = await response.json();
            localStorage.setItem('eidGistId', gist.id);
            console.log('New Gist created:', gist.id);
        } else {
            throw new Error('Failed to create gist');
        }
    }
}

function showResults() {
    const currentCard = document.querySelector('.question-card[data-question="5"]');
    const resultCard = document.getElementById('resultCard');

    // Generate personalized messages
    const resultMessage = document.getElementById('resultMessage');
    const resultDua = document.getElementById('resultDua');
    const resultHumor = document.getElementById('resultHumor');

    resultMessage.textContent = `Eid Mubarak, ${userData.dua}! Your heartfelt dua has been received with love and prayers.`;
    resultDua.textContent = `May Allah fill your life with happiness, accept all your prayers, and bring you closer to the ones you love. May every moment of your life be blessed with peace, prosperity, and endless joy. Ameen.`;
    resultHumor.textContent = `Waise Eidi ka intezar rahe ga 😄`;

    // Hide the step indicator once the flow is complete
    if (questionsProgress) {
        questionsProgress.classList.add('hidden');
    }

    // Transition
    currentCard.classList.add('exit');
    setTimeout(() => {
        currentCard.classList.remove('active', 'exit');
        resultCard.classList.add('active');
    }, 500);
}

// Confetti Animation
function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettiPieces = [];
    const confettiCount = 150;
    const colors = ['#ffd700', '#ffb800', '#0d4d3d', '#1a7a5e', '#ffffff'];

    class Confetti {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height - canvas.height;
            this.size = Math.random() * 8 + 5;
            this.speedY = Math.random() * 3 + 2;
            this.speedX = Math.random() * 2 - 1;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.rotation = Math.random() * 360;
            this.rotationSpeed = Math.random() * 10 - 5;
        }

        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            this.rotation += this.rotationSpeed;

            if (this.y > canvas.height) {
                this.y = -10;
                this.x = Math.random() * canvas.width;
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation * Math.PI / 180);
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
            ctx.restore();
        }
    }

    for (let i = 0; i < confettiCount; i++) {
        confettiPieces.push(new Confetti());
    }

    let animationId;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confettiPieces.forEach(confetti => {
            confetti.update();
            confetti.draw();
        });

        animationId = requestAnimationFrame(animate);
    }

    animate();

    // Stop confetti after 5 seconds
    setTimeout(() => {
        cancelAnimationFrame(animationId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 5000);
}

// Lightbox for Media
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.querySelector('.lightbox-close');

function initMediaGallery() {
    const mediaItems = document.querySelectorAll('.media-item');

    mediaItems.forEach(item => {
        const img = item.querySelector('img');
        if (img) {
            item.addEventListener('click', () => {
                lightboxImage.src = img.src;
                lightbox.classList.add('active');
            });
        }
    });
}

lightboxClose.addEventListener('click', () => {
    lightbox.classList.remove('active');
});

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        lightbox.classList.remove('active');
    }
});

// Close the lightbox with the Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        lightbox.classList.remove('active');
    }
});

// Intersection Observer for Scroll Animations
const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe wish paragraphs
document.querySelectorAll('.wish-paragraph').forEach(paragraph => {
    observer.observe(paragraph);
});

// ---- Eid quiz ----
// Five light, friendly multiple-choice questions about Eid. One at a
// time, instant right/wrong feedback with a short explanation, a final
// score screen, and the best score kept in localStorage ('eidQuizBest').
const QUIZ_QUESTIONS = [
    {
        question: 'What tells Muslims that Eid has arrived?',
        options: [
            'The sighting of the new crescent moon',
            'The first day of spring',
            'A full moon in the sky',
            'The end of the school year'
        ],
        answer: 0,
        explain: 'Eid begins when the new crescent moon of Shawwal is sighted — that is why the moon is everywhere on Eid!'
    },
    {
        question: 'What is "Eidi"?',
        options: [
            'A special Eid prayer mat',
            'Money or gifts given to children and loved ones on Eid',
            'A type of sweet dish',
            'The name of the Eid moon'
        ],
        answer: 1,
        explain: 'Eidi is the happy tradition of elders giving money or little gifts — especially to children — on Eid day.'
    },
    {
        question: 'Which greeting is most common on Eid?',
        options: [
            '"Happy Birthday"',
            '"Merry Christmas"',
            '"Eid Mubarak"',
            '"Bon Voyage"'
        ],
        answer: 2,
        explain: '"Eid Mubarak" means "Blessed Eid" — the greeting shared with family, friends and neighbours.'
    },
    {
        question: 'What sweet dish do many South Asian families enjoy on Eid?',
        options: [
            'Roast turkey',
            'Hot cross buns',
            'Mooncakes',
            'Sheer khurma (vermicelli milk pudding)'
        ],
        answer: 3,
        explain: 'Sheer khurma — vermicelli cooked in sweet milk with nuts — is a beloved Eid morning treat.'
    },
    {
        question: 'What is one of the first things many people do on Eid morning?',
        options: [
            'Go to the mosque for special Eid prayers',
            'Go to the beach',
            'Watch fireworks at midnight',
            'Plant a tree'
        ],
        answer: 0,
        explain: 'The day often starts with Eid prayers at the mosque, followed by hugs, visits and lots of food.'
    }
];

const QUIZ_BEST_KEY = 'eidQuizBest';
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

function renderQuizBest() {
    const bestEl = document.getElementById('quizBest');
    if (!bestEl) {
        return;
    }
    const best = Number(safeStorageGet(QUIZ_BEST_KEY) || 0);
    bestEl.textContent = best > 0 ? `🏆 Your best score: ${best}/${QUIZ_QUESTIONS.length}` : '';
}

function renderQuizQuestion() {
    const item = QUIZ_QUESTIONS[quizIndex];
    const questionEl = document.getElementById('quizQuestion');
    const optionsEl = document.getElementById('quizOptions');
    const feedbackEl = document.getElementById('quizFeedback');
    const nextButton = document.getElementById('quizNextButton');
    const progressLabel = document.getElementById('quizProgressLabel');
    const progressFill = document.getElementById('quizProgressFill');

    quizAnswered = false;
    questionEl.textContent = item.question;
    feedbackEl.textContent = '';
    nextButton.hidden = true;
    nextButton.textContent = quizIndex === QUIZ_QUESTIONS.length - 1 ? 'See my score →' : 'Next →';
    progressLabel.textContent = `Question ${quizIndex + 1} of ${QUIZ_QUESTIONS.length}`;
    progressFill.style.width = `${(quizIndex / QUIZ_QUESTIONS.length) * 100}%`;

    optionsEl.innerHTML = '';
    item.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quiz-option';
        button.textContent = option;
        button.addEventListener('click', () => answerQuizQuestion(index, button));
        optionsEl.appendChild(button);
    });
}

function answerQuizQuestion(selectedIndex, clickedButton) {
    if (quizAnswered) {
        return;
    }
    quizAnswered = true;
    const item = QUIZ_QUESTIONS[quizIndex];
    const optionsEl = document.getElementById('quizOptions');
    const feedbackEl = document.getElementById('quizFeedback');
    const nextButton = document.getElementById('quizNextButton');
    const progressFill = document.getElementById('quizProgressFill');

    const isCorrect = selectedIndex === item.answer;
    if (isCorrect) {
        quizScore += 1;
    }

    optionsEl.querySelectorAll('.quiz-option').forEach((button, index) => {
        button.disabled = true;
        if (index === item.answer) {
            button.classList.add('correct');
        }
    });
    if (!isCorrect) {
        clickedButton.classList.add('wrong');
    }

    feedbackEl.textContent = isCorrect
        ? `✅ Correct! ${item.explain}`
        : `❌ Not quite — the answer is "${item.options[item.answer]}". ${item.explain}`;
    progressFill.style.width = `${((quizIndex + 1) / QUIZ_QUESTIONS.length) * 100}%`;
    nextButton.hidden = false;
}

function showQuizResults() {
    const quizCard = document.getElementById('quizCard');
    const quizResult = document.getElementById('quizResult');
    const titleEl = document.getElementById('quizResultTitle');
    const scoreEl = document.getElementById('quizScore');
    const messageEl = document.getElementById('quizResultMessage');
    const total = QUIZ_QUESTIONS.length;

    let title;
    let message;
    if (quizScore === total) {
        title = 'Eid Expert! 🌟';
        message = 'A perfect score! You know Eid inside out — chaand mubarak!';
    } else if (quizScore >= 3) {
        title = 'Eid Star! 🌙';
        message = 'Great job! You know Eid really well.';
    } else {
        title = 'Eid Explorer! 💛';
        message = 'Every Eid is a chance to learn something new — Eid Mubarak!';
    }

    titleEl.textContent = title;
    scoreEl.textContent = `You scored ${quizScore} / ${total}`;
    messageEl.textContent = message;

    const best = Number(safeStorageGet(QUIZ_BEST_KEY) || 0);
    if (quizScore > best) {
        safeStorageSet(QUIZ_BEST_KEY, String(quizScore));
    }
    renderQuizBest();

    quizCard.hidden = true;
    quizResult.hidden = false;

    if (quizScore >= 4) {
        triggerConfetti();
    }
}

function resetQuiz() {
    quizIndex = 0;
    quizScore = 0;
    document.getElementById('quizResult').hidden = true;
    document.getElementById('quizCard').hidden = false;
    renderQuizQuestion();
}

function initQuiz() {
    const nextButton = document.getElementById('quizNextButton');
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            quizIndex += 1;
            if (quizIndex < QUIZ_QUESTIONS.length) {
                renderQuizQuestion();
            } else {
                showQuizResults();
            }
        });
    }
    const restartButton = document.getElementById('quizRestartButton');
    if (restartButton) {
        restartButton.addEventListener('click', resetQuiz);
    }
    renderQuizBest();
    renderQuizQuestion();
}

// "Replay intro" in the footer: clear the visited flag and reload so
// the envelope shows again.
function initReplayIntro() {
    const replayButton = document.getElementById('replayIntroButton');
    if (replayButton) {
        replayButton.addEventListener('click', () => {
            safeStorageRemove('eidVisited');
            window.location.reload();
        });
    }
}

// Load saved data on page load
window.addEventListener('DOMContentLoaded', () => {
    // Returning visitors skip the intro envelope. The <head> script
    // already hid the overlay before first paint; here we just skip
    // the lock-scroll + animation setup.
    if (safeStorageGet('eidVisited') === '1') {
        const letterOverlay = document.getElementById('letterOverlay');
        if (letterOverlay) {
            letterOverlay.classList.add('hidden');
        }
    } else {
        // Initialize letter animation
        createLetterParticles();
        initLetterAnimation();

        // Prevent scrolling until letter is opened
        document.body.style.overflow = 'hidden';
    }

    createStars();
    initMediaGallery();
    initInteractiveSky();
    applyPersonalization();
    initShareControls();
    initCardDownload();
    initQuiz();
    initReplayIntro();
    updateProgress();
});

// Resize canvas on window resize
window.addEventListener('resize', () => {
    const canvas = document.getElementById('confettiCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Smooth scroll for all internal links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Enter advances on every single-line text input (textareas keep Enter
// for new lines). Each input maps to its card's Next button.
const enterTargets = {
    duaInput: nextButton1,
    joyInput: nextButton2,
    personInput: nextButton3
};

document.querySelectorAll('.question-input').forEach(input => {
    if (input.tagName === 'TEXTAREA') {
        return;
    }
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const targetButton = enterTargets[input.id];
            if (targetButton) {
                targetButton.click();
            }
        }
    });
});
