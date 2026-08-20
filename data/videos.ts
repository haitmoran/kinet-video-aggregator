export type VideoPlatform = "YouTube" | "Vimeo" | "Dailymotion";

export type VideoItem = {
  id: string;
  title: string;
  category: string;
  platform: VideoPlatform;
  creator: string;
  duration: string;
  views: string;
  age: string;
  thumbnail: string;
  preview: string;
  href: string;
  accent: string;
};

type VideoSeed = Omit<VideoItem, "id" | "href">;

const seeds: VideoSeed[] = [
  {
    title: "The quiet art of finding your own pace",
    category: "Documentary",
    platform: "Vimeo",
    creator: "Field Notes",
    duration: "08:42",
    views: "1.8M views",
    age: "2 days ago",
    thumbnail: "thumbnails/01.webp",
    preview: "previews/01.mp4",
    accent: "#ff5c35",
  },
  {
    title: "Inside the cities being built for tomorrow",
    category: "Design",
    platform: "YouTube",
    creator: "Future Form",
    duration: "12:18",
    views: "864K views",
    age: "6 hours ago",
    thumbnail: "thumbnails/02.webp",
    preview: "previews/02.mp4",
    accent: "#306cff",
  },
  {
    title: "Why the deep ocean still feels like space",
    category: "Science",
    platform: "YouTube",
    creator: "Curious Matter",
    duration: "16:05",
    views: "3.4M views",
    age: "1 week ago",
    thumbnail: "thumbnails/03.webp",
    preview: "previews/03.mp4",
    accent: "#00a6a6",
  },
  {
    title: "A cinematic walk through the northern forest",
    category: "Travel",
    platform: "Vimeo",
    creator: "Outside In",
    duration: "04:37",
    views: "492K views",
    age: "3 days ago",
    thumbnail: "thumbnails/04.webp",
    preview: "previews/04.mp4",
    accent: "#2f7d5c",
  },
  {
    title: "Homes that disappear into the landscape",
    category: "Architecture",
    platform: "Dailymotion",
    creator: "Open House",
    duration: "10:24",
    views: "721K views",
    age: "4 days ago",
    thumbnail: "thumbnails/05.webp",
    preview: "previews/05.mp4",
    accent: "#bd7b46",
  },
  {
    title: "The science behind a genuinely great coffee",
    category: "Food",
    platform: "YouTube",
    creator: "Good Rituals",
    duration: "07:56",
    views: "2.1M views",
    age: "8 days ago",
    thumbnail: "thumbnails/06.webp",
    preview: "previews/06.mp4",
    accent: "#7f5540",
  },
  {
    title: "Building a tiny computer from first principles",
    category: "Technology",
    platform: "YouTube",
    creator: "Low Level",
    duration: "21:14",
    views: "978K views",
    age: "11 hours ago",
    thumbnail: "thumbnails/07.webp",
    preview: "previews/07.mp4",
    accent: "#6d5dfc",
  },
  {
    title: "A visual tour of the universe we can observe",
    category: "Science",
    platform: "Vimeo",
    creator: "Orbital",
    duration: "14:22",
    views: "5.7M views",
    age: "2 weeks ago",
    thumbnail: "thumbnails/08.webp",
    preview: "previews/08.mp4",
    accent: "#6558d3",
  },
  {
    title: "Five techniques that transform home cooking",
    category: "Food",
    platform: "YouTube",
    creator: "The Weeknight Table",
    duration: "09:41",
    views: "1.2M views",
    age: "5 days ago",
    thumbnail: "thumbnails/09.webp",
    preview: "previews/09.mp4",
    accent: "#df7b35",
  },
  {
    title: "What consistency actually looks like",
    category: "Wellness",
    platform: "Dailymotion",
    creator: "Everyday Motion",
    duration: "06:12",
    views: "340K views",
    age: "1 day ago",
    thumbnail: "thumbnails/10.webp",
    preview: "previews/10.mp4",
    accent: "#e45576",
  },
  {
    title: "The train journey at the edge of the world",
    category: "Travel",
    platform: "YouTube",
    creator: "Window Seat",
    duration: "18:03",
    views: "2.8M views",
    age: "3 weeks ago",
    thumbnail: "thumbnails/11.webp",
    preview: "previews/11.mp4",
    accent: "#dc594b",
  },
  {
    title: "How color changes everything we understand",
    category: "Art",
    platform: "Vimeo",
    creator: "Studio Visit",
    duration: "11:09",
    views: "608K views",
    age: "4 days ago",
    thumbnail: "thumbnails/12.webp",
    preview: "previews/12.mp4",
    accent: "#e43d8d",
  },
  {
    title: "The instruments hiding inside modern songs",
    category: "Music",
    platform: "YouTube",
    creator: "Deep Listening",
    duration: "13:47",
    views: "4.3M views",
    age: "6 days ago",
    thumbnail: "thumbnails/13.webp",
    preview: "previews/13.mp4",
    accent: "#934de4",
  },
  {
    title: "The discovery that rewrote a century of physics",
    category: "Science",
    platform: "Dailymotion",
    creator: "Known Unknowns",
    duration: "19:32",
    views: "772K views",
    age: "9 days ago",
    thumbnail: "thumbnails/14.webp",
    preview: "previews/14.mp4",
    accent: "#187aab",
  },
  {
    title: "How one frame can tell an entire story",
    category: "Photography",
    platform: "Vimeo",
    creator: "Contact Sheet",
    duration: "05:58",
    views: "954K views",
    age: "2 days ago",
    thumbnail: "thumbnails/15.webp",
    preview: "previews/15.mp4",
    accent: "#c2774d",
  },
  {
    title: "A calmer way to design your working day",
    category: "Ideas",
    platform: "YouTube",
    creator: "Better Systems",
    duration: "08:16",
    views: "1.6M views",
    age: "12 hours ago",
    thumbnail: "thumbnails/16.webp",
    preview: "previews/16.mp4",
    accent: "#4d7cfe",
  },
];

const editions = [
  "Editor's cut",
  "Field study",
  "New perspective",
  "Weekend watch",
  "Visual essay",
  "Deep dive",
  "Creator edition",
  "Essential viewing",
  "Second chapter",
  "Archive selection",
  "Extended story",
  "Audience favorite",
];

function platformSearch(platform: VideoPlatform, title: string): string {
  const query = encodeURIComponent(title);

  if (platform === "Vimeo") return `https://vimeo.com/search?q=${query}`;
  if (platform === "Dailymotion") {
    return `https://www.dailymotion.com/search/${query}/videos`;
  }

  return `https://www.youtube.com/results?search_query=${query}`;
}

export const videos: VideoItem[] = Array.from({ length: 192 }, (_, index) => {
  const seed = seeds[index % seeds.length];
  const cycle = Math.floor(index / seeds.length);
  const title = cycle === 0 ? seed.title : `${seed.title} · ${editions[cycle - 1]}`;

  return {
    ...seed,
    id: `video-${String(index + 1).padStart(3, "0")}`,
    title,
    href: platformSearch(seed.platform, seed.title),
  };
});

export const categories = [
  "All",
  "Documentary",
  "Design",
  "Science",
  "Travel",
  "Technology",
  "Food",
  "Art",
  "Music",
  "Wellness",
];
