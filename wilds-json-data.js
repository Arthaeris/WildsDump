const JSON_DATA = {};

async function loadJsonDatabase() {
  const files = [
    "accessory",
    "amulet",
    "armor",
    "armorupgrade",
    "charm",
    "item",
    "largemonsters",
    "partnames",
    "skill",
    "species",
    "stage",
    "weaponseries"
  ];

  await Promise.all(
    files.map(async file => {
      const response = await fetch(`./json/${file}.json.txt`);
      JSON_DATA[file] = await response.json();
    })
  );
}