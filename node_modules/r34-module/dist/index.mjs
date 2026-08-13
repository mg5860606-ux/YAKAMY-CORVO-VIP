// src/rule34/rule34.ts
import axios from "axios";

// src/base_functions/base_function.ts
import { load } from "cheerio";
import { create } from "axios";
async function api_pid(base_URL, tags) {
  const customAxios = create({
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    }
  });
  let { data } = await customAxios(
    `${base_URL}/index.php?page=post&s=list&tags=${tags}+&pid=0`
  );
  const $ = load(data);
  let last = $(".pagination a").map((i, el) => $(el).attr("href")).get();
  if (last.length != 0) {
    let rem = Number(last[last.length - 1].split("=")[4]);
    if (rem > 168e3) rem = 168e3;
    return rem;
  }
  return 0;
}
function total_api_pages(pid) {
  let totalImages = pid;
  let imagesPerPage = 100;
  let numberOfPages = Math.ceil(totalImages / imagesPerPage);
  return numberOfPages;
}

// src/rule34/rule34.ts
async function r34_random({ gay_block } = { gay_block: false }) {
  let pages = total_api_pages(168e3);
  let random = Math.floor(Math.random() * pages);
  let { data } = await axios(
    `https://api.rule34.xxx/index.php?page=dapi&s=post&pid=${random}&q=index&json=1`
  );
  let ray = [...data.map((obj) => obj.file_url)];
  if (gay_block == true) {
    let urlSet = /* @__PURE__ */ new Set();
    let block = [
      "male",
      "gay",
      "trap",
      "yaoi",
      "balls",
      "dick",
      "boy",
      "trap",
      "furry",
      "bovid",
      "demon",
      "dog",
      "penis"
    ];
    data.forEach((obj) => {
      if (block.some((element) => obj.tags.includes(element))) {
        urlSet.add(obj.file_url);
      }
    });
    ray = ray.filter((url) => !urlSet.has(url));
    return ray;
  } else {
    return ray;
  }
}
async function r34_search({ search_tags = [], block_tags = [] }) {
  let search_tag = search_tags.toString().replace(",", "+");
  const pid = await api_pid("https://rule34.xxx", search_tag);
  if (pid == 0 || search_tag.length === 0) return { status: 400 };
  let pages = total_api_pages(pid);
  if (pages != 0) {
    let random = Math.floor(Math.random() * pages);
    let { data } = await axios(
      `https://api.rule34.xxx/index.php?page=dapi&s=post&tags=${search_tag}&pid=${random}&q=index&json=1`
    );
    let ray = [...data.map((obj) => obj.file_url)];
    if (block_tags.length != 0) {
      let urlSet = /* @__PURE__ */ new Set();
      data.forEach((obj) => {
        if (block_tags.some((element) => obj.tags.includes(element))) {
          urlSet.add(obj.file_url);
        }
      });
      const clean_array = ray.filter((url) => !urlSet.has(url));
      return clean_array;
    } else {
      return ray;
    }
  }
}

// src/xbooru/xbooru.ts
import axios2 from "axios";
var xbooru_search = async ({ search_tags = [], block_tags = [] }) => {
  let search_tag = search_tags.toString().replace(",", "+");
  let pid = await api_pid("https://xbooru.com", search_tag);
  if (pid == 0 || search_tag.length === 0) return { status: 400 };
  let pages = total_api_pages(pid);
  let random = Math.floor(Math.random() * pages);
  let { data } = await axios2(
    `https://xbooru.com/index.php?page=dapi&s=post&tags=${search_tag}&pid=${random}&q=index&json=1`
  );
  let ray = [
    ...data.map(
      (obj) => `https://img.xbooru.com/images/${obj.directory}/${obj.image}`
    )
  ];
  if (block_tags.length != 0) {
    let urlSet = /* @__PURE__ */ new Set();
    data.forEach(
      (obj) => {
        if (block_tags.some((element) => obj.tags.includes(element))) {
          urlSet.add(
            `https://img.xbooru.com/images/${obj.directory}/${obj.image}`
          );
        }
      }
    );
    const clean_array = ray.filter((url) => !urlSet.has(url));
    return clean_array;
  }
  return ray;
};
var xbooru_random = async ({ gay_block } = { gay_block: false }) => {
  let pages = total_api_pages(168e3);
  let random = Math.floor(Math.random() * pages);
  let { data } = await axios2(
    `https://xbooru.com/index.php?page=dapi&s=post&pid=${random}&q=index&json=1`
  );
  let ray = [...data.map((obj) => `https://img.xbooru.com/images/${obj.directory}/${obj.image}`)];
  if (gay_block == true) {
    let urlSet = /* @__PURE__ */ new Set();
    let block = [
      "male",
      "gay",
      "trap",
      "yaoi",
      "balls",
      "dick",
      "boy",
      "trap",
      "furry",
      "bovid",
      "demon",
      "dog",
      "penis"
    ];
    data.forEach((obj) => {
      if (block.some((element) => obj.tags.includes(element))) {
        urlSet.add(`https://img.xbooru.com/images/${obj.directory}/${obj.image}`);
      }
    });
    ray = ray.filter((url) => !urlSet.has(url));
    return ray;
  } else {
    return ray;
  }
};

// src/hypnohub/hypnohub.ts
import axios3 from "axios";
var hypno_random = async ({ gay_block } = { gay_block: false }) => {
  let pages = total_api_pages(109788);
  let random = Math.floor(Math.random() * pages);
  let { data } = await axios3(
    `https://hypnohub.net/index.php?page=dapi&s=post&pid=${random}&q=index&json=1`
  );
  let ray = [...data.map((obj) => obj.file_url)];
  if (gay_block == true) {
    let urlSet = /* @__PURE__ */ new Set();
    let block = [
      "male",
      "gay",
      "trap",
      "yaoi",
      "balls",
      "dick",
      "boy",
      "trap",
      "furry",
      "bovid",
      "demon",
      "dog",
      "penis"
    ];
    data.forEach((obj) => {
      if (block.some((element) => obj.tags.includes(element))) {
        urlSet.add(obj.file_url);
      }
    });
    ray = ray.filter((url) => !urlSet.has(url));
    return ray;
  } else {
    return ray;
  }
};
async function hypno_search({ search_tags = [], block_tags = [] }) {
  let search_tag = search_tags.toString().replace(",", "+");
  const pid = await api_pid("https://hypnohub.net", search_tag);
  if (pid == 0 || search_tag.length === 0) return { status: 400 };
  let pages = total_api_pages(pid);
  if (pages != 0) {
    let random = Math.floor(Math.random() * pages);
    let { data } = await axios3(
      `https://hypnohub.net/index.php?page=dapi&s=post&tags=${search_tag}&pid=${random}&q=index&json=1`
    );
    let ray = [...data.map((obj) => obj.file_url)];
    if (block_tags.length != 0) {
      let urlSet = /* @__PURE__ */ new Set();
      data.forEach((obj) => {
        if (block_tags.some((element) => obj.tags.includes(element))) {
          urlSet.add(obj.file_url);
        }
      });
      const clean_array = ray.filter((url) => !urlSet.has(url));
      return clean_array;
    } else {
      return ray;
    }
  }
}

// src/safebooru/safebooru.ts
import axios4 from "axios";
var safe_random = async () => {
  let pages = total_api_pages(18e4);
  let random = Math.floor(Math.random() * pages);
  let { data } = await axios4(
    `https://safebooru.org/index.php?page=dapi&s=post&pid=${random}&q=index&json=1`
  );
  let ray = [
    ...data.map(
      (obj) => `https://safebooru.org//images/${obj.directory}/${obj.image}`
    )
  ];
  return ray;
};
async function safe_search({ search_tags = [], block_tags = [] }) {
  let search_tag = search_tags.toString().replace(",", "+");
  const pid = await api_pid("https://safebooru.org", search_tag);
  if (pid == 0 || search_tag.length === 0) return { status: 400 };
  let pages = total_api_pages(pid);
  if (pages != 0) {
    let random = Math.floor(Math.random() * pages);
    let { data } = await axios4(
      `https://safebooru.org/index.php?page=dapi&s=post&tags=${search_tag}&pid=${random}&q=index&json=1`
    );
    let ray = [
      ...data.map(
        (obj) => `https://safebooru.org//images/${obj.directory}/${obj.image}`
      )
    ];
    if (block_tags.length != 0) {
      let urlSet = /* @__PURE__ */ new Set();
      data.forEach((obj) => {
        if (block_tags.some((element) => obj.tags.includes(element))) {
          urlSet.add(`https://safebooru.org//images/${obj.directory}/${obj.image}`);
        }
      });
      const clean_array = ray.filter((url) => !urlSet.has(url));
      return clean_array;
    } else {
      return ray;
    }
  }
}

// src/realbooru/realbooru.ts
import axios5 from "axios";
var real_search = async ({ search_tags = [], block_tags = [] }) => {
  let search_tag = search_tags.toString().replace(",", "+");
  let pid = await api_pid("https://realbooru.com", search_tag);
  if (pid == 0 || search_tag.length === 0) return { status: 400 };
  let pages = total_api_pages(pid);
  let random = Math.floor(Math.random() * pages);
  let { data } = await axios5(
    `https://realbooru.com/index.php?page=dapi&s=post&tags=${search_tag}&pid=${random}&q=index&json=1`
  );
  let ray = [
    ...data.map(
      (obj) => `https://realbooru.com/images/${obj.directory}/${obj.hash}.${obj.image.split(".")[1]}`
    )
  ];
  if (block_tags.length != 0) {
    let urlSet = /* @__PURE__ */ new Set();
    data.forEach(
      (obj) => {
        if (block_tags.some((element) => obj.tags.includes(element))) {
          urlSet.add(
            `https://realbooru.com/images/${obj.directory}/${obj.hash}.${obj.image.split(".")[1]}`
          );
        }
      }
    );
    const clean_array = ray.filter((url) => !urlSet.has(url));
    return clean_array;
  }
  return ray;
};
var real_random = async ({ gay_block } = { gay_block: false }) => {
  let pages = total_api_pages(168e3);
  let random = Math.floor(Math.random() * pages);
  let { data } = await axios5(
    `https://realbooru.com/index.php?page=dapi&s=post&pid=${random}&q=index&json=1`
  );
  let ray = [
    ...data.map(
      (obj) => `https://realbooru.com/images/${obj.directory}/${obj.hash}.${obj.image.split(".")[1]}`
    )
  ];
  if (gay_block == true) {
    let urlSet = /* @__PURE__ */ new Set();
    let block = [
      "shemale",
      "gay",
      "trap",
      "trans_female",
      "transgender",
      "fake_breasts",
      "male_only",
      "dick"
    ];
    data.forEach(
      (obj) => {
        if (block.some((element) => obj.tags.includes(element))) {
          urlSet.add(
            `https://realbooru.com/images/${obj.directory}/${obj.hash}.${obj.image.split(".")[1]}`
          );
        }
      }
    );
    ray = ray.filter((url) => !urlSet.has(url));
    return ray;
  }
  return ray;
};
export {
  hypno_random,
  hypno_search,
  r34_random,
  r34_search,
  real_random,
  real_search,
  safe_random,
  safe_search,
  xbooru_random,
  xbooru_search
};
