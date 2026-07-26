import * as THREE from "three";

/** Perfis dos garçons — personalidade + aparência procedural. */
export const WAITERS = [
  {
    id: "toninho",
    name: "Toninho",
    skin: 0xc68642,
    hair: 0x2a1a10,
    hairStyle: "short",
    face: "grumpy",
    height: 1.0,
    lines: {
      greet: [
        "…o que foi?",
        "Tô no meio do serviço. Fala rápido.",
        "Se for pra pedir água com gás, já sabe onde fica.",
      ],
      chat: [
        "Hoje o movimento tá ruim. Ou bom. Tanto faz.",
        "Não me pede pra sorrir. Não tá no contrato.",
        "Fabin ri por dois. Eu trabalho.",
      ],
      order: [
        "Cerveja? Claro. Mais alguma coisa ou só isso mesmo?",
        "Já anotei. Não precisa agradecer.",
      ],
      story: [
        "O jogo na TV? Se o Amarelinho perder eu finjo que não vi.",
        "Já vi cliente pedir batida especial e pedir outra em seguida. Sem vergonha.",
      ],
      tipThanks: ["…obrigado. Raro.", "Hm. Valeu."],
    },
  },
  {
    id: "fabin",
    name: "Fabin",
    skin: 0xd9a066,
    hair: 0x3b2414,
    hairStyle: "short",
    face: "smile",
    height: 1.02,
    lines: {
      greet: [
        "E aí, campeão! Chegou no Amarelinho!",
        "Opa! Boa noite! Mesa ou balcão?",
        "Seja bem-vindo! Hoje a gelada tá especial.",
      ],
      chat: [
        "Esse bar é família. Todo mundo que chega vira conhecido.",
        "Toninho parece bravo, mas no fundo… tá, ele é meio bravo mesmo.",
        "Se precisar de qualquer coisa, é só chamar. Tô sempre por aqui!",
      ],
      order: [
        "Pode deixar comigo! Já já chega geladinha.",
        "Boa escolha! Vou buscar pra você.",
      ],
      story: [
        "Quando a TV dá gol, o bar inteiro pula — até o Toninho quase sorri.",
        "Minha teoria: quem pede porção faz amigo. Quem pede água… também, mas demora mais.",
      ],
      tipThanks: ["Valeu demais, campeão!", "Gorjeta? Você é o cara!"],
    },
  },
  {
    id: "oliveira",
    name: "Seu Oliveira",
    skin: 0x5c3a28,
    hair: 0x1a120e,
    hairStyle: "baldish",
    face: "kind",
    height: 0.96,
    lines: {
      greet: [
        "Boa noite, meu filho. Como é que tá?",
        "Chegou bem? Senta, descansa.",
        "Ô, prazer. Oliveira, às suas ordens.",
      ],
      chat: [
        "Eu já vi muita noite nessa calçada. Essa aqui ainda tá começando.",
        "O Amarelinho não muda. As paredes amarelas, as mesas… e a gente.",
        "Quer um conselho? Pede a porção e divide. Sempre rende conversa.",
      ],
      order: [
        "Vou cuidar disso com carinho. Um minutinho.",
        "Já anotei, meu filho. Pode ficar tranquilo.",
      ],
      story: [
        "Essa calçada já viu chuva, sol e muita conversa. O amarelo das paredes não murcha.",
        "Seu Zé conta o mesmo causo há anos — e a gente ainda ri.",
      ],
      tipThanks: ["Que Deus te abençoe.", "Obrigado, meu filho."],
    },
  },
  {
    id: "val",
    name: "Val",
    skin: 0xc4a484,
    hair: 0x9a9a9a,
    hairStyle: "medium",
    face: "neutral",
    height: 1.04,
    lines: {
      greet: [
        "Fala. Precisa de alguma coisa?",
        "Beleza. O que vai ser?",
        "Chegou na hora certa. Ainda tem mesa.",
      ],
      chat: [
        "Esse cabelo? Sempre foi assim. Grisalho veio de brinde.",
        "Ney conta história pra caramba. Vale a pena ouvir.",
        "Calçada lotada, TV ligada… noite típica de Amarelinho.",
      ],
      order: [
        "Pode pedir o que quiser… aqui só tem gelo e limão. Já levo o copo.",
        "Anotado. Spoiler: vem gelo e limão. Sempre.",
      ],
      story: [
        "Jukebox no canto azul — se a batida falhar, culpa o cabo, não o Val.",
        "Na hora do almoço, se pedir copo só com gelo, eu fico puto. Gelo E limão. Entendeu?",
        "Calabresa acebolada e jogo na TV. Receita de noite boa.",
      ],
      tipThanks: ["Valeu.", "Fechou. Agradeço."],
    },
  },
  {
    id: "ney",
    name: "Ney",
    skin: 0xd2b48c,
    hair: 0xf2f2f0,
    hairStyle: "short-white",
    face: "kind",
    height: 0.94,
    lines: {
      greet: [
        "Ô, boa noite! Chega mais, chega mais.",
        "Meu amigo! Que alegria te ver por aqui.",
        "Senta com a gente. O bar é teu também.",
      ],
      chat: [
        "Eu tô aqui desde… ah, deixa pra lá. Faz tempo.",
        "Carlinhos nunca tira o boné. Nem no calor. Nem na chuva.",
        "Se a TV tiver jogo, o bar inteiro vira torcida.",
      ],
      order: [
        "Já peço pro pessoal da cozinha. Já já chega!",
        "Pode deixar com o velho Ney.",
      ],
      story: [
        "Eu vi o primeiro placar dessa TV. Era tubo. Hoje é pixel, mas o grito é o mesmo.",
        "Se chover na calçada, a mesa coberta vira ouro. Sempre foi assim.",
      ],
      tipThanks: ["Ô, obrigado, meu amigo!", "Você tem coração bom."],
    },
  },
  {
    id: "carlinhos",
    name: "Carlinhos",
    skin: 0x4a2c1a,
    hair: 0x1a120e,
    hairStyle: "cap",
    face: "neutral",
    height: 1.0,
    lines: {
      greet: [
        "E aí. Cozinha quente — o que precisa?",
        "Fala, brother. Chapa ligada, boné firme.",
        "Chegou na hora. Tô no fogão.",
      ],
      chat: [
        "Aqui é chapa e fogão. O resto do bar que converse.",
        "Porção saindo: cheiro já avisou a calçada.",
        "Toninho anota, eu faço. Divisão de trabalho.",
        "Cuidado com o óleo — a noite é longa.",
      ],
      order: [
        "Manda o pedido. Já ponho na chapa.",
        "Gelada eu não carrego — mas a porção eu resolvo.",
        "Anota aí… fogão a mil. Já já sai.",
      ],
      story: [
        "Torresmo, bolinho, calabresa — a chapa não dorme. Eu também não.",
        "O cheiro sobe pro salão elevado. Marketing gratuito.",
      ],
      tipThanks: ["Valeu, brother.", "Gorjeta na cozinha? Raro. Obrigado."],
    },
  },
];

/** Cliente fixo — causos diferentes a cada noite. */
export const REGULAR = {
  id: "ze",
  name: "Seu Zé",
  skin: 0x8d5524,
  hair: 0xf2f2f0,
  hairStyle: "baldish",
  face: "kind",
  height: 0.95,
  shirt: 0x3a5a3a,
  pants: 0x2a2a30,
  stories: [
    "Uma vez pedi batida especial e o Fabin trouxe duas. Disse que era promoção. Mentira — era amizade.",
    "Choveu tanto que a calçada virou rio. A gente pediu porção e esperou o dilúvio passar.",
    "O Carlinhos jura que o boné é amuleto. Eu juro que é falta de penteado.",
    "Vi o Amarelinho virar o jogo no último minuto. O bar tremeu. Até o Toninho bateu palma.",
    "Seu Oliveira me ensinou: divide a porção, multiplica a conversa.",
  ],
  lines: {
    greet: [
      "Ô, chega mais. Quer ouvir um causo?",
      "Boa noite. Eu sou o Zé — freguês de carteirinha.",
      "Senta um pouco. História boa não cobra entrada.",
    ],
    chat: [
      "Tô aqui quase toda noite. O amarelo das paredes me acalma.",
      "A jukebox às vezes falha. A conversa, nunca.",
    ],
    order: ["Eu já pedi. Agora é só acompanhar o jogo."],
  },
};

const CUSTOMER_NAMES = [
  "João", "Maria", "Pedro", "Ana", "Lucas", "Bia", "Rafa", "Ju", "Diego", "Cami",
  "Bruno", "Léo", "Paula", "Tiago", "Fê", "Guga", "Carol", "Duda", "Igor", "Nina",
  "Theo", "Lara", "Caio", "Mel", "Vini", "Pri", "Hugo", "Sofia", "Enzo", "Lia",
  "Kaique", "Yasmin", "Murilo", "Isis", "Davi", "Alice", "Heitor", "Helena",
];

const SKINS = [0xc68642, 0xd9a066, 0x5c3a28, 0x4a2c1a, 0xe0ac69, 0x8d5524, 0xf1c27d, 0xc4a484, 0x3b2314];
const HAIRS = [0x1a120e, 0x2a1a10, 0x3b2414, 0x5a3a20, 0x9a9a9a, 0xf2f2f0, 0x6b4423, 0x111111, 0xc45c26];
const SHIRTS = [0x2a4a7a, 0x8b2020, 0x2d6a3e, 0xc9a000, 0x3a3a48, 0x6b3fa0, 0xd4782a, 0x1a5f7a, 0xb85c38, 0xeeeeee];
const PANTS = [0x1a1a22, 0x2a3548, 0x3a2a1a, 0x222228, 0x4a5568];
const HAIR_STYLES = ["short", "medium", "baldish", "cap", "short-white"];
const FACES = ["neutral", "smile", "kind", "grumpy"];

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r, color, opts) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, opts));
  m.castShadow = true;
  return m;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeNametag(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(12, 8, 2, 0.82)";
  ctx.fillRect(8, 8, 240, 48);
  ctx.strokeStyle = "#ffd84a";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 236, 44);
  ctx.fillStyle = "#ffd84a";
  ctx.font = "bold 28px Bebas Neue, Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.toUpperCase(), 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true })
  );
  sprite.scale.set(1.15, 0.28, 1);
  sprite.position.y = 2.15;
  return sprite;
}

function makeChatBubble() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  sprite.scale.set(0.7, 0.28, 1);
  sprite.position.y = 2.35;
  sprite.visible = false;
  const paint = (text) => {
    ctx.clearRect(0, 0, 160, 64);
    ctx.fillStyle = "rgba(255, 246, 214, 0.94)";
    ctx.fillRect(12, 8, 136, 40);
    ctx.fillStyle = "#1a1408";
    ctx.font = "bold 18px DM Sans, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const t = String(text || "…").slice(0, 14);
    ctx.fillText(t, 80, 30);
    tex.needsUpdate = true;
  };
  paint("…");
  sprite.userData.setText = paint;
  return sprite;
}

function makeLogoBadge() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c41e1e";
  ctx.beginPath();
  ctx.moveTo(64, 12);
  ctx.lineTo(108, 36);
  ctx.lineTo(100, 100);
  ctx.lineTo(64, 116);
  ctx.lineTo(28, 100);
  ctx.lineTo(20, 36);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffd84a";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = "#fff6d6";
  ctx.beginPath();
  ctx.arc(64, 58, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1000";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("AMA", 64, 62);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.22),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  badge.position.set(0, 1.15, -0.14);
  badge.rotation.y = Math.PI;
  return badge;
}

function addFaceAndHair(bodyRoot, def) {
  const head = sphere(0.18, def.skin);
  head.position.y = 1.52;
  bodyRoot.add(head);

  const eyeL = sphere(0.03, 0xf5f5f5);
  eyeL.position.set(-0.06, 1.54, 0.15);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.06;
  bodyRoot.add(eyeL, eyeR);
  const pupilL = sphere(0.015, 0x1a1a1a);
  pupilL.position.set(-0.06, 1.54, 0.17);
  const pupilR = pupilL.clone();
  pupilR.position.x = 0.06;
  bodyRoot.add(pupilL, pupilR);

  if (def.face === "grumpy") {
    const brow = box(0.24, 0.035, 0.04, 0x2a1a10);
    brow.position.set(0, 1.6, 0.15);
    brow.rotation.z = 0.2;
    bodyRoot.add(brow);
    const mouth = box(0.1, 0.025, 0.03, 0x5a2030);
    mouth.position.set(0, 1.43, 0.165);
    mouth.rotation.z = Math.PI;
    bodyRoot.add(mouth);
  } else if (def.face === "smile") {
    const mouth = box(0.14, 0.03, 0.03, 0x8a3040);
    mouth.position.set(0, 1.44, 0.17);
    bodyRoot.add(mouth);
    const cheekL = sphere(0.035, 0xe09080);
    cheekL.position.set(-0.11, 1.48, 0.14);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.11;
    bodyRoot.add(cheekL, cheekR);
  } else if (def.face === "kind") {
    const mouth = box(0.1, 0.022, 0.03, 0x7a4050);
    mouth.position.set(0, 1.445, 0.16);
    bodyRoot.add(mouth);
  } else {
    const mouth = box(0.08, 0.02, 0.03, 0x6a4050);
    mouth.position.set(0, 1.445, 0.16);
    bodyRoot.add(mouth);
  }

  if (def.hairStyle === "cap") {
    const cap = box(0.4, 0.12, 0.42, def.capColor ?? 0x1a1a1a);
    cap.position.set(0, 1.7, 0.02);
    bodyRoot.add(cap);
    const bill = box(0.24, 0.045, 0.2, 0x222222);
    bill.position.set(0, 1.65, 0.24);
    bodyRoot.add(bill);
  } else if (def.hairStyle === "medium") {
    const hair = box(0.38, 0.26, 0.36, def.hair);
    hair.position.set(0, 1.64, -0.02);
    bodyRoot.add(hair);
    const sideL = box(0.09, 0.24, 0.14, def.hair);
    sideL.position.set(-0.2, 1.5, 0.02);
    const sideR = sideL.clone();
    sideR.position.x = 0.2;
    bodyRoot.add(sideL, sideR);
  } else if (def.hairStyle === "short-white" || def.hairStyle === "short") {
    const hair = box(0.35, 0.11, 0.33, def.hair);
    hair.position.set(0, 1.67, -0.01);
    bodyRoot.add(hair);
  } else if (def.hairStyle === "baldish") {
    const fringe = box(0.22, 0.06, 0.12, def.hair);
    fringe.position.set(0, 1.65, -0.1);
    bodyRoot.add(fringe);
  }
}

/** Low-poly waiter mesh com traços distintos + nametag. */
export function buildWaiterMesh(def) {
  const root = new THREE.Group();
  root.name = def.id;
  const scale = def.height || 1;
  const bodyRoot = new THREE.Group();
  bodyRoot.scale.setScalar(scale);
  root.add(bodyRoot);

  const body = box(0.42, 0.62, 0.24, 0x151515);
  body.position.y = 1.05;
  bodyRoot.add(body);
  bodyRoot.add(makeLogoBadge());

  const apron = box(0.44, 0.38, 0.06, 0x111111);
  apron.position.set(0, 0.92, 0.14);
  bodyRoot.add(apron);

  const legs = box(0.36, 0.55, 0.22, 0x1a1a1a);
  legs.position.y = 0.4;
  bodyRoot.add(legs);

  const shoes = box(0.4, 0.08, 0.28, 0x0a0a0a);
  shoes.position.y = 0.06;
  bodyRoot.add(shoes);

  addFaceAndHair(bodyRoot, def);
  root.add(makeNametag(def.name));
  const bubble = makeChatBubble();
  root.add(bubble);
  root.userData.npcId = def.id;
  root.userData.kind = "waiter";
  root.userData.chatBubble = bubble;
  return root;
}

/** Cliente casual — aparência muda a cada acesso. */
export function randomCustomerDef(usedNames = new Set()) {
  let name = pick(CUSTOMER_NAMES);
  let guard = 0;
  while (usedNames.has(name) && guard++ < 40) name = pick(CUSTOMER_NAMES);
  usedNames.add(name);
  return {
    id: `cust_${name.toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: pick(HAIR_STYLES),
    face: pick(FACES),
    height: 0.92 + Math.random() * 0.14,
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    capColor: pick([0x1a1a1a, 0x8b2020, 0x2a4a7a, 0x222222]),
  };
}

export function buildCustomerMesh(def) {
  const root = new THREE.Group();
  root.name = def.id;
  const scale = def.height || 1;
  const bodyRoot = new THREE.Group();
  bodyRoot.scale.setScalar(scale);
  root.add(bodyRoot);

  const body = box(0.4, 0.58, 0.22, def.shirt);
  body.position.y = 1.05;
  bodyRoot.add(body);

  const legs = box(0.34, 0.52, 0.2, def.pants);
  legs.position.y = 0.4;
  bodyRoot.add(legs);

  const shoes = box(0.38, 0.07, 0.26, 0x1a1410);
  shoes.position.y = 0.06;
  bodyRoot.add(shoes);

  addFaceAndHair(bodyRoot, def);

  const tag = makeNametag(def.name);
  tag.scale.set(0.95, 0.24, 1);
  root.add(tag);
  const bubble = makeChatBubble();
  root.add(bubble);

  root.userData.npcId = def.id;
  root.userData.kind = "customer";
  root.userData.chatBubble = bubble;
  return root;
}

export function pickLine(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
