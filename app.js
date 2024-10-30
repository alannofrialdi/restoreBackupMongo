const { exec } = require("child_process");
require("dotenv").config();
const fs = require("fs");
const unzipper = require("unzipper");
const path = require("path");

function backupMongoDB() {
  const dbName = process.env.DB_NAME || "nama_database"; // ? nama db
  const backupDir = process.env.BACKUP_DIR || "./backup"; // ? lokasi backup
  const user = process.env.DB_USER || ""; // ? user optional
  const password = process.env.DB_PASSWORD || ""; // ? psw optional
  const host = process.env.DB_HOST || "localhost"; // ? host
  const port = process.env.DB_PORT || 27017; // ? port

  let command = `mongodump --archive=${backupDir} --db=${dbName} --host=${host} --port=${port} --gzip`;

  if (user && password) {
    command += ` --username=${user} --password=${password} --authenticationDatabase=admin`;
  }

  // * eksekusi
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error saat backup: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
    }

    console.log(`stdout: ${stdout}`);
    console.log(`Backup berhasil! Lokasi backup: ${backupDir}`);
  });
}

async function restoreMongoDB() {
  const dbName = process.env.DB_NAME || "nama_database";
  const backupZip = process.env.RESTORE_DIR || "./backup.zip";
  const extractDir = "./dump";
  const user = process.env.DB_USER || "";
  const password = process.env.DB_PASSWORD || "";
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || 27017;

  // ? atur kondisi sesuai dengan backup, jika menggunakan --archive maka true
  const archive = false;

  try {
    if (archive) {
      let command = `mongorestore --nsInclude=${dbName}.* --archive=${backupZip} --host=${host} --port=${port} --gzip --drop`;

      if (user && password) {
        command += `--username=${user} --password=${password} --authenticationDatabase=admin`;
      }

      // * eksekusi
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`error saat restore: ${error.message}`);
          return;
        }

        console.log(
          `Restore berhasil! Database ${dbName} telah direstore dari ${backupZip}`
        );
        console.log(`Command: ${command}`);
      });
    } else {
      // ? hapus folder extract sebelumnya jika ada
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true });
      }

      fs.mkdirSync(extractDir);

      // ? exctract zip nya
      await fs
        .createReadStream(backupZip)
        .pipe(unzipper.Extract({ path: extractDir }))
        .promise();

      console.log("ekstraksi file ZIP selesai.");

      // ? folder yang diekstrak
      const extractedFolders = fs
        .readdirSync(extractDir)
        .filter((file) =>
          fs.statSync(path.join(extractDir, file)).isDirectory()
        );

      if (extractedFolders.length === 0) {
        throw new Error(
          "tidak ada folder yang ditemukan di dalam backup yang diekstrak."
        );
      }

      // ? ubah extractedFolders[0] jika di windows
      const extractedFolder = path.join(extractDir, extractedFolders[1]);
      console.log(`Folder yang diekstrak: ${extractedFolder}`);

      // ? ekstrak semua file
      const files = fs.readdirSync(extractedFolder);

      files.forEach((file) => {
        const fileToRestore = path.join(extractedFolder, file);

        let command = `mongorestore --nsInclude=${dbName} ${fileToRestore} --host=${host} --port=${port} --gzip --drop`;

        if (user && password) {
          command += ` --username=${user} --password=${password} --authenticationDatabase=admin`;
        }

        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`error saat restore file ${file}: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
          }
          console.log(`Restore berhasil untuk file ${file}`);
        });
      });
    }
  } catch (error) {
    console.error(`Gagal mengekstrak atau merestore: ${error.message}`);
  }
}

let action = process.argv[2];
if (action === "backup") {
  backupMongoDB();
} else if (action === "restore") {
  restoreMongoDB();
} else {
  console.log("silahkan gunakan 'backup' atau 'restore' sebagai argumen.");
}
