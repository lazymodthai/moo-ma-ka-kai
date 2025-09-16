// src/data/imageData.ts

// Import รูปภาพทั้งหมดที่คุณเตรียมไว้
import PigImage from '../assets/animal/pig.png';
import DogImage from '../assets/animal/dog.png';
import CrowImage from '../assets/animal/crow.png';
import ChickenImage from '../assets/animal/chicken.png';
import CatImage from '../assets/animal/cat.png';
import AntImage from '../assets/animal/ant.png';
import SnakeImage from '../assets/animal/snake.png';
import HorseImage from '../assets/animal/horse.png';
import FishImage from '../assets/animal/fish.png';


// สร้าง Type สำหรับข้อมูลแต่ละชิ้น
export interface ImageDataObject {
  key: string;
  image: string; // type เป็น string เพราะ import จะแปลงเป็น path
  text: string;
}

// Export Array ของข้อมูลทั้งหมด
export const allImages: ImageDataObject[] = [
  { key: 'pig', image: PigImage, text: 'หมู' },
  { key: 'dog', image: DogImage, text: 'หมา' },
  { key: 'crow', image: CrowImage, text: 'กา' },
  { key: 'chicken', image: ChickenImage, text: 'ไก่' },
  { key: 'cat', image: CatImage, text: 'แมว' },
  { key: 'ant', image: AntImage, text: 'มด' },
  { key: 'snake', image: SnakeImage, text: 'งู' },
  { key: 'horse', image: HorseImage, text: 'ม้า' },
  { key: 'fish', image: FishImage, text: 'ปลา' },
];