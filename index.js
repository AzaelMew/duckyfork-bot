process.on("uncaughtException", (error) => console.log(error));
const fs = require("fs");

// The reaction commands (cat, dog, ...) keep their cooldown timestamp in a file
// in the working directory. Those files are runtime state and are no longer
// tracked by git, so create them on boot: a fresh clone must behave like a host
// that has already run the bot, and the commands read the file before writing
// it.
for (const runtimeStateFile of ["lastCalledTime.txt", "lastDogCalledTime.txt"]) {
  if (!fs.existsSync(runtimeStateFile)) {
    fs.writeFileSync(runtimeStateFile, "");
  }
}

const app = require("./src/Application.js");

("use strict");

app
  .register()
  .then(() => {
    app.connect();
  })
  .catch((error) => {
    console.error(error);
  });
