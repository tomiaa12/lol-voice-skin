import axios from "axios";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const basePath = './src'

axios.interceptors.response.use((res) => res.data);

// 创建文件夹
const createFolder = (folderPath) => {
  if (!existsSync(folderPath)) {
    try {
      mkdirSync(folderPath, { recursive: true });
      console.log(`${folderPath} 创建成功`);
    } catch {}
  }
};
// 依次运行Promise
const queueRun = async (queue) => {
  const run = async (list, i = 0) => {
    if (!list[i]) return;
    await list[i]();
    await run(list, i + 1);
  };
  await run(queue);
};

const data = [];

const { hero } = await axios.get(
  "https://game.gtimg.cn/images/lol/act/img/js/heroList/hero_list.js"
);

/* BP 语音 */
createFolder("./choose"); // 选择语音
createFolder("./ban"); // 禁用语音

await queueRun(
  hero.map((i) => async () => {
    // 选择语音
    try {
      const filePath = join("./choose", `${i.heroId}.mp3`);
      if (!existsSync(filePath)) {
        const res = await axios({
          url: `https://voice-cdn.buguoguo.cn/zh_CN/LCU/champion-choose-vo/${i.heroId}.ogg`,
          responseType: "arraybuffer",
        });

        writeFileSync(filePath, res);
      }
      data.push({
        path: `${basePath}/lol/choose/${i.heroId}.mp3`,
        answer: i.title,
        topic: "语音中的英雄名称是？",
      });
    } catch {
      console.log(i.name, "BP 选择语音下载出错");
    }

    // 禁用语音
    try {
      const filePath1 = join("./ban", `${i.heroId}.mp3`);
      if (!existsSync(filePath1)) {
        const res1 = await axios({
          url: `https://voice-cdn.buguoguo.cn/zh_CN/LCU/champion-ban-vo/${i.heroId}.ogg`,
          responseType: "arraybuffer",
        });

        writeFileSync(filePath1, res1);
      }
      data.push({
        path: `${basePath}/lol/ban/${i.heroId}.mp3`,
        answer: i.title,
        topic: "语音中的英雄名称是？",
      });
    } catch {
      console.log(i.name, "BP 禁用语音下载出错");
    }
  })
);

await Promise.all(
  hero.map(async ({ heroId, title }) => {
    const heroData = await axios.get(
      `https://game.gtimg.cn/images/lol/act/img/js/hero/${heroId}.js`
    );

    /* 皮肤 */
    data.push({
      answer: title,
      path: heroData.skins.map((i) => i.mainImg || i.chromaImg),
      topic: "图片中的英雄名称是？",
    });

    /* 技能 */
    heroData.spells.forEach((i) => {
      data.push({
        answer: i.name,
        path: i.abilityIconPath,
        topic: "图片中的技能名称是？",
      });

      data.push({
        answer: i.name,
        desc: i.description,
        topic: `描述的是${title}的技能名称是？`,
      });
    });
  })
);

/* 语音 */
const d = await axios.get("https://voice.buguoguo.cn/api/config/heroTag");

createFolder("./voice"); // 禁用语音

await queueRun(
  d.data.map((i) => async () => {
    const res = await axios({
      url: "https://voice.buguoguo.cn/api/files/getConfig",
      params: {
        fileName: `${i.heroId}_${i.name}_${i.alias}`,
        skinId: Number(i.heroId + "000"),
        version: 0,
      },
      maxBodyLength: Infinity,
    });
    const voicesData = Object.values(res.data.skin_voice).flat();

    let path = []
    await queueRun(
      voicesData.map((j) => async () => {
        // 英雄语音
        try {
          const filePath = join("./voice", `${j.voice_code}.mp3`);
          if (!existsSync(filePath)) {
            const res = await axios({
              url: `https://voice-cdn.buguoguo.cn/zh_CN/VO/characters/${i.alias}/skin0/${j.voice_code}.wem`,
              responseType: "arraybuffer",
            });

            writeFileSync(filePath, res);
          }
          path.push(`${basePath}/lol/voice/${j.voice_code}.mp3`)
        } catch {
          console.log(i.name, j.voice_translation, "语音下载出错");
        }
      })
    );
    path.length && data.push({
      path,
      answer: i.title,
      topic: "语音中是哪个英雄的声音？",
    });
  })
);

const ws = createWriteStream(resolve("./data.json"));

console.log('end')
ws.write(JSON.stringify(data));
ws.end();
