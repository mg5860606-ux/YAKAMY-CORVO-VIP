const fs = require("fs")
const sabrpg = JSON.parse(fs.readFileSync("./DADOS/usuarios/SystemRPG/sabrpg.json"));

exports.AdicionarGold = (UserID, ValorA) => {
userNumber = sabrpg.map(i => i.id).indexOf(UserID)
sabrpg[userNumber].money += Number(ValorA)
fs.writeFileSync("./DADOS/usuarios/SystemRPG/sabrpg.json", JSON.stringify(sabrpg))
}

exports.RemoverGold = (UserID, ValorR) => {
userNumber = sabrpg.map(i => i.id).indexOf(UserID)
sabrpg[userNumber].money -= Number(ValorR)
fs.writeFileSync("./DADOS/usuarios/SystemRPG/sabrpg.json", JSON.stringify(sabrpg))
}
   