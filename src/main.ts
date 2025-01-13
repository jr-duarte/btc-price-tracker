import {
  app,
  Menu,
  Tray,
  BrowserWindow,
  ipcMain,
  Notification,
  nativeImage,
} from "electron"
import * as path from "path"
import axios from "axios"

let tray: Tray | null = null
let inputWindow: BrowserWindow | null = null
let upperLimit: number | null = null
let lowerLimit: number | null = null

const iconPath = path.join(__dirname, "btc-icon.png")

const fetchBitcoinPrice = async (): Promise<number> => {
  try {
    const response = await axios.get(
      "https://api.binance.com/api/v3/ticker/price",
      {
        params: {
          symbol: "BTCUSDT", // 'BTCUSDT' é o par de criptomoeda (Bitcoin/US Dollar)
        },
      },
    )
    return parseFloat(response.data.price)
  } catch (error) {
    console.error("Erro ao buscar preço do Bitcoin:", error)
    return 0
  }
}

const checkPrice = async () => {
  try {
    const currentPrice = await fetchBitcoinPrice()

    const price = new Intl.NumberFormat("pt-BR", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(currentPrice)

    // Atualizar o título do tray com o preço
    tray?.setTitle(`BTC: $${price}`)

    // Verificar alertas para limite superior
    if (upperLimit && currentPrice >= upperLimit) {
      new Notification({
        title: "Alerta de Preço",
        body: `O Bitcoin atingiu $${price} (ou mais)!`,
      }).show()
      upperLimit = null
    }

    // Verificar alertas para limite inferior
    if (lowerLimit && currentPrice <= lowerLimit) {
      new Notification({
        title: "Alerta de Preço",
        body: `O Bitcoin caiu para $${price} (ou menos)!`,
      }).show()
      lowerLimit = null
    }
  } catch (error) {
    console.error("Erro ao verificar preço:", error)
  }
}

const createInputWindow = (type: "upper" | "lower") => {
  if (inputWindow) {
    inputWindow.focus() // Foca na janela existente
    return
  }

  try {
    inputWindow = new BrowserWindow({
      width: 400,
      height: 300,
      resizable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    })

    inputWindow.loadFile(path.join(__dirname, "input.html"))

    inputWindow.on("closed", () => {
      inputWindow = null
    })

    inputWindow.webContents.once("did-finish-load", () => {
      inputWindow?.webContents.send("set-type", type)
    })
  } catch (error) {
    console.error("Erro ao criar janela de entrada:", error)
  }
}

app.on("ready", () => {
  app.setLoginItemSettings({
    openAtLogin: true, // Configura o app para iniciar automaticamente
    openAsHidden: true, // Abre em segundo plano sem mostrar a janela principal
  })

  const icon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 })

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Definir limite superior",
      click: () => createInputWindow("upper"),
    },
    {
      label: "Definir limite inferior",
      click: () => createInputWindow("lower"),
    },
    { type: "separator" },
    {
      label: "Fechar",
      click: () => app.exit(),
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip("Bitcoin Price Tracker")

  // Checar o preço a cada 30 segundos
  setInterval(checkPrice, 30000)

  // Verificar preço imediatamente
  checkPrice()

  // Impedir que o app saia quando todas as janelas forem fechadas
  app.on("window-all-closed", () => {
    // Impede que o app feche automaticamente
  })

  if (process.platform === "darwin") {
    app.dock.hide()
  }
})

// Receber os valores do input
ipcMain.on("set-limit", (event, { type, value }) => {
  try {
    if (typeof value !== "number" || isNaN(value) || value <= 0) {
      throw new Error("Valor inválido. Insira um número maior que zero.")
    }

    if (type === "upper") {
      upperLimit = value

      const price = new Intl.NumberFormat("pt-BR", {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(upperLimit)

      new Notification({
        title: "Limite Superior Definido",
        body: `Alerta será exibido quando o Bitcoin atingir $${price}`,
      }).show()
    } else if (type === "lower") {
      lowerLimit = value

      const price = new Intl.NumberFormat("pt-BR", {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(lowerLimit)

      new Notification({
        title: "Limite Inferior Definido",
        body: `Alerta será exibido quando o Bitcoin cair para $${price}`,
      }).show()
    }

    inputWindow?.close()
  } catch (error) {
    console.error("Erro ao processar limite:", error)
    new Notification({
      title: "Erro",
      body: "Não foi possível definir o limite. Verifique o valor inserido.",
    }).show()
  }
})
