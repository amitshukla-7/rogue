import crypto from 'crypto';

export interface SeedStudent {
  id: string;
  name: string;
  handle: string;
  email: string;
  year: string;
  branch: string;
  bio: string;
  photos: string[];
  college_verified: boolean;
  interests: number[]; // interest IDs
  prompt: {
    question: string;
    answer: string;
  };
}


export const SEED_STUDENTS: SeedStudent[] = [
  {
    id: 'student-demo-1',
    name: 'Amit Kumar',
    handle: 'amit_tech',
    email: 'amit.kumar@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'CSE',
    bio: 'Tech enthusiast | Full-stack web dev & competitive programmer 🚀',
    photos: ['https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 6, 7], // Coding, Hackathons, Gaming
    prompt: {
      question: 'I could talk for hours about...',
      answer: 'The impact of AI agents on software development and late-night hackathons.'
    }
  },
  {
    id: 'student-demo-2',
    name: 'Riya Singh',
    handle: 'riya_ai',
    email: 'riya.singh@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'CSE',
    bio: 'AI researcher in the making | Lofi music & coffee lover ☕',
    photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 2, 6], // Coding, Music, Hackathons
    prompt: {
      question: 'The best way to start my day is...',
      answer: 'A hot caramel macchiato while listening to indie pop.'
    }
  },
  {
    id: 'student-demo-3',
    name: 'Arjun Verma',
    handle: 'arjun_val',
    email: 'arjun.v@mitsgw.ac.in',
    year: '3rd Year',
    branch: 'IT',
    bio: 'Backend developer | BGMI & Valorant player 🎮',
    photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 5, 7], // Coding, Anime, Gaming
    prompt: {
      question: 'A random fact about me...',
      answer: 'I built my own water-cooled gaming rig from scratch.'
    }
  },
  {
    id: 'student-demo-4',
    name: 'Mehak Gupta',
    handle: 'mehak_dance',
    email: 'mehak.g@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'ECE',
    bio: 'Dance club lead | Bookworm & amateur photographer 📷',
    photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [2, 3, 5], // Music, Photography, Anime
    prompt: {
      question: 'Key to my heart...',
      answer: 'Spontaneous road trips and deep conversations over tea.'
    }
  },
  {
    id: 'student-demo-5',
    name: 'Aditya Rao',
    handle: 'aditya_f1',
    email: 'aditya.rao@mitsgw.ac.in',
    year: '3rd Year',
    branch: 'CSE',
    bio: 'F1 fanatic | Mobile app dev & UI/UX explorer 🏎️',
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 4, 7], // Coding, Football, Gaming
    prompt: {
      question: 'My weekend plan is...',
      answer: 'Watching the Formula 1 Grand Prix live with friends!'
    }
  },
  {
    id: 'student-demo-6',
    name: 'Sneha Iyer',
    handle: 'sneha_sec',
    email: 'sneha.iyer@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'CSE',
    bio: 'Cybersecurity fanatic | Reader & movie addict 🎬',
    photos: ['https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 3, 5],
    prompt: {
      question: 'What are you building this weekend?',
      answer: 'A packet analyzer GUI in Rust.'
    }
  },
  {
    id: 'student-demo-7',
    name: 'Kabir Malhotra',
    handle: 'kabir_robotics',
    email: 'kabir.m@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'Mechanical',
    bio: 'Robotics enthusiast & mountain hiker 🏔️',
    photos: ['https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [3, 4, 6],
    prompt: {
      question: 'Next destination on list...',
      answer: 'Trekking to Kedarkantha Peak.'
    }
  },
  {
    id: 'student-demo-8',
    name: 'Ananya Deshmukh',
    handle: 'ananya_ai',
    email: 'ananya.d@mitsgw.ac.in',
    year: '1st Year',
    branch: 'AI & Data Science',
    bio: 'Freshman curious about neural networks & classical guitar 🎸',
    photos: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 2, 6],
    prompt: {
      question: 'I could talk for hours about...',
      answer: 'How transformer architectures revolutionized NLP.'
    }
  },
  {
    id: 'student-demo-9',
    name: 'Rohan Sharma',
    handle: 'rohan_striker',
    email: 'rohan.s@mitsgw.ac.in',
    year: '4th Year',
    branch: 'Electrical',
    bio: 'Final year student | Smart grid tech & football vice-captain ⚽',
    photos: ['https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [4, 6, 7],
    prompt: {
      question: 'The best way to start my day is...',
      answer: 'Morning football drills at the college ground.'
    }
  },
  {
    id: 'student-demo-10',
    name: 'Pooja Nair',
    handle: 'pooja_cloud',
    email: 'pooja.nair@mitsgw.ac.in',
    year: '3rd Year',
    branch: 'CSE',
    bio: 'Cloud architecture geek | Open source contributor ☁️',
    photos: ['https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 6, 3],
    prompt: {
      question: 'A random fact about me...',
      answer: 'I have maintainer status on three GitHub open source projects.'
    }
  },
  {
    id: 'student-demo-11',
    name: 'Devansh Joshi',
    handle: 'devansh_guitar',
    email: 'devansh.j@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'Civil',
    bio: '3D modeling enthusiast & acoustic guitarist 🎵',
    photos: ['https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [2, 3, 5],
    prompt: {
      question: 'Key to my heart...',
      answer: 'Good acoustic jams and sunsets.'
    }
  },
  {
    id: 'student-demo-12',
    name: 'Tara Kapoor',
    handle: 'tara_design',
    email: 'tara.k@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'IT',
    bio: 'Web3 developer & digital illustrator 🎨',
    photos: ['https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 3, 6],
    prompt: {
      question: 'What are you building this weekend?',
      answer: 'An NFT gallery app for college artists.'
    }
  },
  {
    id: 'student-demo-13',
    name: 'Siddharth Patel',
    handle: 'sid_grandmaster',
    email: 'siddharth.p@mitsgw.ac.in',
    year: '3rd Year',
    branch: 'CSE',
    bio: 'Competitive coding candidate | Chess & Badminton player ♟️',
    photos: ['https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 4, 7],
    prompt: {
      question: 'I could talk for hours about...',
      answer: 'Chess opening strategies and LeetCode hard problems.'
    }
  },
  {
    id: 'student-demo-14',
    name: 'Kavya Saxena',
    handle: 'kavya_iot',
    email: 'kavya.s@mitsgw.ac.in',
    year: '1st Year',
    branch: 'ECE',
    bio: 'IoT tinkerer | Arduino projects & retro synthwave 🎹',
    photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 2, 6],
    prompt: {
      question: 'A random fact about me...',
      answer: 'I programmed my room lights to flash whenever my code builds!'
    }
  },
  {
    id: 'student-demo-15',
    name: 'Yash Vardhan',
    handle: 'yash_speed',
    email: 'yash.v@mitsgw.ac.in',
    year: '4th Year',
    branch: 'Mechanical',
    bio: 'Automotive design lead | Formula Student racing team 🚗',
    photos: ['https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [3, 4, 7],
    prompt: {
      question: 'Next destination on list...',
      answer: 'Buddh International Circuit for track day.'
    }
  },
  {
    id: 'student-demo-16',
    name: 'Ishita Roy',
    handle: 'ishita_voice',
    email: 'ishita.r@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'CSE',
    bio: 'Product manager aspirant | Podcaster & campus host 🎙️',
    photos: ['https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [2, 3, 6],
    prompt: {
      question: 'The best way to start my day is...',
      answer: 'Recording a quick 5-minute tech news podcast.'
    }
  },
  {
    id: 'student-demo-17',
    name: 'Aman Tripathi',
    handle: 'aman_docker',
    email: 'aman.t@mitsgw.ac.in',
    year: '3rd Year',
    branch: 'IT',
    bio: 'DevOps & Docker lover | Anime reviewer on YouTube 🍿',
    photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 5, 7],
    prompt: {
      question: 'I could talk for hours about...',
      answer: 'The plot twists in Attack on Titan and Steins;Gate.'
    }
  },
  {
    id: 'student-demo-18',
    name: 'Niharika Sen',
    handle: 'niharika_drones',
    email: 'niharika.s@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'ECE',
    bio: 'Robotics enthusiast & drone pilot 🛸',
    photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 3, 6],
    prompt: {
      question: 'What are you building this weekend?',
      answer: 'An autonomous obstacle avoidance drone.'
    }
  },
  {
    id: 'student-demo-19',
    name: 'Vikramaditya Shah',
    handle: 'vikram_ml',
    email: 'vikram.s@mitsgw.ac.in',
    year: '3rd Year',
    branch: 'CSE',
    bio: 'ML Engineer | Kaggle Grandmaster aspirant 🧠',
    photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [1, 6, 7],
    prompt: {
      question: 'Key to my heart...',
      answer: 'Clean dataset graphs and low validation loss.'
    }
  },
  {
    id: 'student-demo-20',
    name: 'Diya Banerji',
    handle: 'diya_stars',
    email: 'diya.b@mitsgw.ac.in',
    year: '2nd Year',
    branch: 'Civil',
    bio: 'Sustainable architecture fan | Stargazer & poet 🌌',
    photos: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80'],
    college_verified: true,
    interests: [2, 3, 5],
    prompt: {
      question: 'A random fact about me...',
      answer: 'I know all 88 constellations in the night sky by name.'
    }
  }
];

export const SEED_POSTS = [
  {
    id: 'post-seed-1',
    author_id: 'student-demo-1',
    title: 'Hackathon alert! Building an AI study co-pilot this weekend 🚀',
    content: 'Hey everyone! Our team is looking for a frontend developer proficient in Next.js & Tailwind CSS for the upcoming 36-hour campus hackathon. Anyone interested in teaming up? Free pizza and energy drinks guaranteed! 🍕⚡',
    topic: 'Tech',
    media_url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    upvotes: 24,
    downvotes: 1
  },
  {
    id: 'post-seed-2',
    author_id: 'student-demo-2',
    title: 'Best silent study spots on campus with good Wi-Fi? 📚☕',
    content: 'Finals week is approaching! The central library main hall gets super crowded after 4 PM. What are your favorite quiet corners or cafes near campus where you can code and study peacefully?',
    topic: 'Advice',
    media_url: null,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    upvotes: 18,
    downvotes: 0
  },
  {
    id: 'post-seed-3',
    author_id: 'student-demo-4',
    title: 'Golden hour captures near the college lake 🌅✨',
    content: 'Took a walk around the east campus grounds yesterday evening. The lighting was magical! Here is one of my favorite shots from yesterday.',
    topic: 'Memes',
    media_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    upvotes: 32,
    downvotes: 2
  },
  {
    id: 'post-seed-4',
    author_id: 'student-demo-5',
    title: 'F1 Watch Party for Italian GP this Sunday at the Student Activity Center! 🏎️',
    content: 'Calling all Formula 1 fans! We are setting up the big projector screen in the SAC hall. Streaming starts at 6:30 PM. Drop a comment if you are coming!',
    topic: 'Events',
    media_url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    upvotes: 29,
    downvotes: 0
  },
  {
    id: 'post-seed-5',
    author_id: 'student-demo-10',
    title: 'Open Source Workshop: Docker & Kubernetes for Beginners ☁️',
    content: 'We are hosting a hands-on workshop this Friday in Lab 3. We will build, containerize, and deploy a full-stack web app step by step. Completely beginner friendly!',
    topic: 'Tech',
    media_url: null,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    upvotes: 41,
    downvotes: 1
  }
];

export const SEED_COMMENTS = [
  {
    id: 'comment-seed-1',
    post_id: 'post-seed-1',
    author_id: 'student-demo-2',
    content: 'Count me in! I can handle the Next.js UI & state management! 🙋‍♀️',
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString()
  },
  {
    id: 'comment-seed-2',
    post_id: 'post-seed-1',
    author_id: 'student-demo-3',
    content: 'I can help set up Node.js Express backend and APIs if you need backend support!',
    created_at: new Date(Date.now() - 3600000 * 1.2).toISOString()
  },
  {
    id: 'comment-seed-3',
    post_id: 'post-seed-2',
    author_id: 'student-demo-6',
    content: 'The 3rd floor reading room in the Innovation Block is super quiet and has ultra fast Wi-Fi!',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'comment-seed-4',
    post_id: 'post-seed-4',
    author_id: 'student-demo-9',
    content: 'Definitely coming! Forza Ferrari! 🔴🏎️',
    created_at: new Date(Date.now() - 3600000 * 15).toISOString()
  }
];

export const SEED_FOLLOWS = [
  { follower_id: 'student-demo-1', following_id: 'student-demo-2', created_at: new Date().toISOString() },
  { follower_id: 'student-demo-1', following_id: 'student-demo-4', created_at: new Date().toISOString() },
  { follower_id: 'student-demo-2', following_id: 'student-demo-1', created_at: new Date().toISOString() },
  { follower_id: 'student-demo-3', following_id: 'student-demo-1', created_at: new Date().toISOString() },
  { follower_id: 'student-demo-4', following_id: 'student-demo-2', created_at: new Date().toISOString() }
];

