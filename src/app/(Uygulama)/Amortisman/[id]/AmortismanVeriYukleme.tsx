import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import { dictionary } from "@/utils/languages/handsontable.tr-TR";
import "handsontable/dist/handsontable.full.min.css";
import { plus } from "@/utils/theme/Typography";
import { useDispatch, useSelector } from "@/store/hooks";
import { AppState } from "@/store/store";
import { Grid, Paper, Typography, useTheme } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { getFormat } from "@/api/Veri/base";
import { enqueueSnackbar } from "notistack";
import ExceleAktarButton from "@/app/(Uygulama)/components/Buttons/ExceleAktarButton";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { setCollapse } from "@/store/customizer/CustomizerSlice";
import {
  createAmortismanVerisi,
  deleteAmortismanVerisi,
  getAmortismanVerileriByDenetciDenetlenenYil,
} from "@/api/Veri/Amortisman";
import numbro from "numbro";
import trTR from "numbro/languages/tr-TR";

// register Handsontable's modules
registerAllModules();

numbro.registerLanguage(trTR);
numbro.setLanguage("tr-TR");

interface Veri {
  detayHesapKodu: string;
  hesapAdi: string;
  amortismanBaslangicTarihi: string;
  eldenCikarmaTarihi: string;
  girisTutari: number;
  yenidenDegerlemeArtisi: number;
  iptalEdilecekYenidenDegerlemeTutari: number;
  kalintiDeger: number;
  amortismanUsulu: string;
  bobiTfrsFaydaliOmur: number;
  vukFaydaliOmur: number;
  vukKistAmortisman: string;
}

interface Props {
  denetciId?: number;
  denetlenenId?: number;
  yil?: number;
  kaydetTiklandimi: boolean;
  setKaydetTiklandimi: (b: boolean) => void;
  setSonKaydedilmeTarihi: (str: string) => void;
}

const AmortismanVeriYukleme: React.FC<Props> = ({
  denetciId,
  denetlenenId,
  yil,
  kaydetTiklandimi,
  setKaydetTiklandimi,
  setSonKaydedilmeTarihi,
}) => {
  const hotTableComponent = useRef<any>(null);

  const customizer = useSelector((state: AppState) => state.customizer);
  const dispatch = useDispatch();
  const theme = useTheme();

  const [rowCount, setRowCount] = useState<number>(200);

  const [fetchedData, setFetchedData] = useState<Veri[]>([]);

  const [duplicatesControl, setDuplicatesControl] = useState(false);

  const uyari = [
    "Boş Bırakılmaması Gereken Sütunlar: Detay Hesap Kodu, Hesap Adı, Başlangıç Tarihi, Giriş Tutarı",
    "Detay Hesap Kodu Ve Hesap Adı Sütunları Boş Bırakılmamalıdır.",
    "Başlangıç Tarihi Sütunu Boş Bırakılmamalıdır Ve GG.AA.YYYY Formatında Tarih Girilmelidir.",
    "Elden Çıkarma Tarihi Sütununa GG.AA.YYYY Formatında Tarih Girilmelidir Veya Boş Bırakılabilir.",
    "Giriş Tutarı Sütunu Boş Bırakılmamalıdır Ve Ondalıklı Sayı Girilmelidir.",
    "Yeniden Değerleme Artışı, İptal Edilecek Yeniden Değerleme Tutarı Ve Kalıntı Değer Sütunlarına Ondalıklı Sayı Girilmelidir Veya Boş Bırakılabilir.",
    "Amortisman Usulü Ve Vuk Kıst Amortisman Sütunlarında Seçeneklerden Biri Seçilmelidir Veya Boş Bırakılabilir.",
    "Faydalı Ömür Ve Vuk Faydalı Ömür Sütunlarına Tam Sayı Girilmelidir Veya Boş Bırakılabilir.",
  ];

  const [endRow, setEndRow] = useState(-1);

  useEffect(() => {
    const loadStyles = async () => {
      dispatch(setCollapse(true));
      if (customizer.activeMode === "dark") {
        await import(
          "@/app/(Uygulama)/components/HandsOnTable/HandsOnTableDark.css"
        );
      } else {
        await import(
          "@/app/(Uygulama)/components/HandsOnTable/HandsOnTableLight.css"
        );
      }
    };

    loadStyles();
  }, [customizer.activeMode]);

  const textValidator = (value: string, callback: (value: boolean) => void) => {
    if (!value || value.trim() === "") {
      // Eğer değer boşsa geçersiz kabul et
      callback(false);
    } else {
      callback(true);
    }
  };

  const numberValidator = (
    value: string,
    callback: (value: boolean) => void
  ) => {
    const numberRegex = /^[0-9]+(\.[0-9]+)?$/; // Regex to match numbers with optional decimal part
    if (numberRegex.test(value)) {
      callback(true);
    } else {
      callback(false);
    }
  };

  const numberValidatorAllowNull = (
    value: string,
    callback: (value: boolean) => void
  ) => {
    const numberRegex = /^[0-9]+(\.[0-9]+)?$/; // Regex to match numbers with optional decimal part
    if (!value || String(value).trim() === "") {
      // Eğer değer boşsa geçerli kabul et
      callback(true);
    } else if (numberRegex.test(value)) {
      callback(true);
    } else {
      callback(false);
    }
  };

  const integerValidator = (
    value: string,
    callback: (value: boolean) => void
  ) => {
    const integerRegex = /^\d+$/; // Regex to match integers only
    if (integerRegex.test(value)) {
      callback(true);
    } else {
      callback(false);
    }
  };

  const dateValidator = (
    value: string,
    callback: (isValid: boolean) => void
  ) => {
    // Tarih formatı düzenli ifadesi (dd.mm.yyyy)
    const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    if (dateRegex.test(value)) {
      callback(true);
    } else {
      callback(false);
    }
  };

  const dateValidatorAllowNull = (
    value: string,
    callback: (isValid: boolean) => void
  ) => {
    // Tarih formatı düzenli ifadesi (dd.mm.yyyy)
    const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    if (!value || value.trim() === "") {
      // Eğer değer boşsa geçerli kabul et
      callback(true);
    } else if (dateRegex.test(value)) {
      const [, day, month, year] = value.match(dateRegex)!;

      const date = new Date(`${year}-${month}-${day}`);
      const isValidDate =
        date.getFullYear() === Number(year) &&
        date.getMonth() + 1 === Number(month) &&
        date.getDate() === Number(day);

      callback(isValidDate);
    } else {
      callback(false);
    }
  };

  function isRowEmpty(row: Veri): boolean {
    return Object.values(row).every(
      (value) =>
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "")
    );
  }

  function findDuplicateRows(data: Veri[]): number[] {
    const seenRows = new Set<string>();
    const duplicates: number[] = [];

    data.forEach((row, index) => {
      if (isRowEmpty(row)) return; // tüm değerler boşsa geç

      const rowString = JSON.stringify(row, Object.keys(row).sort());

      if (seenRows.has(rowString)) {
        duplicates.push(index + 1);
      } else {
        seenRows.add(rowString);
      }
    });

    return duplicates;
  }

  useEffect(() => {
    if (duplicatesControl) {
      const duplicateRowNumbers = findDuplicateRows(fetchedData);

      if (duplicateRowNumbers.length > 0) {
        const duplicatesMessage = duplicateRowNumbers.join(", ") + " ";

        enqueueSnackbar(
          `${duplicatesMessage}Numaralı Satır${
            duplicateRowNumbers.length > 1 ? "lar" : ""
          } Tekrar Eden Veri İçeriyor. Kontrol Edin.`,
          {
            variant: "warning",
            autoHideDuration: 5000,
            style: {
              backgroundColor:
                customizer.activeMode === "dark"
                  ? theme.palette.warning.dark
                  : theme.palette.warning.main,
              maxWidth: "720px",
            },
          }
        );
      }

      setDuplicatesControl(false);
    }
  }, [duplicatesControl]);

  const colHeaders = [
    "D. Hesap Kodu",
    "Hesap Adı",
    "Satın Alma Tarihi",
    "Elden Çıkarma Tarihi",
    "Giriş Tutarı",
    "Y. D. Artışı",
    "İptal Edilecek Y. D. Tutarı",
    "Kalıntı Değer",
    "A. Usulü",
    "Faydalı Ömür",
    "Vuk Faydalı Ömür",
    "Vuk Kıst Amortisman",
  ];

  const columns = [
    {
      type: "text",
      columnSorting: true,
      className: "htLeft",
      validator: textValidator,
      allowInvalid: false,
    }, // Detay Hesap Kodu
    {
      type: "text",
      columnSorting: true,
      className: "htLeft",
      validator: textValidator,
      allowInvalid: false,
    }, // Hesap Adı
    {
      type: "date",
      dateFormat: "DD.MM.YYYY",
      columnSorting: true,
      className: "htRight",
      validator: dateValidator,
      allowInvalid: false,
    }, // Satın Alma Tarihi
    {
      type: "date",
      dateFormat: "DD.MM.YYYY",
      columnSorting: true,
      className: "htRight",
      validator: dateValidatorAllowNull,
      allowInvalid: false,
    }, // Elden Çıkarma Tarihi
    {
      type: "numeric",
      numericFormat: {
        pattern: "0,0.00",
        columnSorting: true,
        culture: "tr-TR",
      },
      className: "htRight",
      validator: numberValidator,
      allowInvalid: false,
    }, // Giriş Tutarı
    {
      type: "numeric",
      numericFormat: {
        pattern: "0,0.00",
        columnSorting: true,
        culture: "tr-TR",
      },
      className: "htRight",
      validator: numberValidatorAllowNull,
      allowInvalid: false,
    }, // Yeniden Değerleme Artışı
    {
      type: "numeric",
      numericFormat: {
        pattern: "0,0.00",
        columnSorting: true,
        culture: "tr-TR",
      },
      className: "htRight",
      validator: numberValidatorAllowNull,
      allowInvalid: false,
    }, // İptal Edilecek Yeniden Değerleme Tutarı
    {
      type: "numeric",
      numericFormat: {
        pattern: "0,0.00",
        columnSorting: true,
        culture: "tr-TR",
      },
      className: "htRight",
      validator: numberValidatorAllowNull,
      allowInvalid: false,
    }, // Kalıntı Değer
    {
      type: "dropdown",
      source: ["Normal", "Hızlandırılmış"],
      columnSorting: true,
      className: "htLeft",
      allowInvalid: false,
    }, // Amortisman Usulü
    {
      type: "numeric",
      numericFormat: {
        pattern: "0,0",
        columnSorting: true,
        culture: "tr-TR",
      },
      className: "htRight",
      validator: integerValidator,
      allowInvalid: false,
    }, // Bobi/Tfrs Faydalı Ömür
    {
      type: "numeric",
      numericFormat: {
        pattern: "0,0",
        columnSorting: true,
        culture: "tr-TR",
      },
      className: "htRight",
      validator: integerValidator,
      allowInvalid: false,
    }, // Vuk Faydalı Ömür
    {
      type: "dropdown",
      source: ["", "Evet", "Hayır"],
      columnSorting: true,
      className: "htLeft",
      allowInvalid: false,
    }, // Vuk Kıst Amortisman
  ];

  const afterGetColHeader = (col: any, TH: any) => {
    TH.style.height = "50px";

    let div = TH.querySelector("div");
    if (!div) {
      div = document.createElement("div");
      TH.appendChild(div);
    }

    div.style.whiteSpace = "normal";
    div.style.wordWrap = "break-word";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.height = "100%";
    div.style.position = "relative";

    //typography body1
    TH.style.fontFamily = plus.style.fontFamily;
    TH.style.fontWeight = 500;
    TH.style.fontSize = "0.875rem";
    TH.style.lineHeight = "1.334rem";

    //color
    TH.style.color = customizer.activeMode === "dark" ? "#ffffff" : "#2A3547";
    TH.style.backgroundColor = theme.palette.primary.light;
    //customizer.activeMode === "dark" ? "#253662" : "#ECF2FF";

    TH.style.borderColor = customizer.activeMode === "dark" ? "#10141c" : "#";

    // Create span for the header text
    let span = div.querySelector("span");
    if (!span) {
      span = document.createElement("span");
      div.appendChild(span);
    }
    span.textContent = colHeaders[col];
    span.style.position = "absolute";
    span.style.marginRight = "16px";
    span.style.left = "4px";

    // Create button if it does not exist
    let button = div.querySelector("button");
    if (!button) {
      button = document.createElement("button");
      button.style.display = "none";
      div.appendChild(button);
    }
    button.style.position = "absolute";
    button.style.right = "4px";
  };

  const afterGetRowHeader = (row: any, TH: any) => {
    let div = TH.querySelector("div");
    div.style.whiteSpace = "normal";
    div.style.wordWrap = "break-word";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "center";
    div.style.height = "100%";

    //typography body1
    TH.style.fontFamily = plus.style.fontFamily;
    TH.style.fontWeight = 500;
    TH.style.fontSize = "0.875rem";
    TH.style.lineHeight = "1.334rem";

    //color
    TH.style.color = customizer.activeMode === "dark" ? "#ffffff" : "#2A3547";
    TH.style.backgroundColor = theme.palette.primary.light;
    //customizer.activeMode === "dark" ? "#253662" : "#ECF2FF";

    TH.style.borderColor = customizer.activeMode === "dark" ? "#10141c" : "#";
  };

  const afterRenderer = (
    TD: any,
    row: any,
    col: any,
    prop: any,
    value: any,
    cellProperties: any
  ) => {
    //typography body1
    TD.style.fontFamily = plus.style.fontFamily;
    TD.style.fontWeight = 500;
    TD.style.fontSize = "0.875rem";
    TD.style.lineHeight = "1.334rem";
    //TD.style.textAlign = "left";

    //color
    TD.style.color = customizer.activeMode === "dark" ? "#ffffff" : "#2A3547";

    if (row % 2 === 0) {
      TD.style.backgroundColor =
        customizer.activeMode === "dark" ? "#171c23" : "#ffffff";
      TD.style.borderColor =
        customizer.activeMode === "dark" ? "#10141c" : "#cccccc";
    } else {
      TD.style.backgroundColor =
        customizer.activeMode === "dark" ? "#10141c" : "#cccccc";
      TD.style.borderColor =
        customizer.activeMode === "dark" ? "#10141c" : "#cccccc";
      TD.style.borderRightColor =
        customizer.activeMode === "dark" ? "#171c23" : "#ffffff";
    }

    if (row <= endRow && (value == undefined || value == null || value == "")) {
      TD.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
    }
  };

  const handleGetRowData = async (row: number) => {
    if (hotTableComponent.current) {
      const hotInstance = hotTableComponent.current.hotInstance;
      const cellMeta = hotInstance.getDataAtRow(row);
      console.log("Satır Verileri:", cellMeta);
      return cellMeta;
    }
  };

  const handleCreateRow = async (index: number, amount: number) => {
    if (amount == 1 && index != rowCount - 1) {
      console.log(
        `Yeni satır(lar) eklendi: ${amount} adet satır ${index} indexinden itibaren.`
      );
    }
  };

  const handleAfterRemoveRow = async (
    index: number,
    amount: number,
    physicalRows: number[],
    source: any
  ) => {
    console.log(
      `Satır(lar) silindi: ${amount} adet satır ${index} indexinden itibaren.${physicalRows}`
    );
  };

  const afterPaste = async (data: any, coords: any) => {
    console.log("Pasted data:", data);

    console.log("Pasted startRow coordinates:", coords[0].startRow);
    console.log("Pasted endRow coordinates:", coords[0].endRow);
    console.log("Pasted startCol coordinates:", coords[0].startCol);
    console.log("Pasted endCol coordinates:", coords[0].endCol);

    if (endRow < coords[0].endRow) {
      setEndRow(coords[0].endRow);
    }
  };

  const handleAfterChange = async (changes: any, source: any) => {
    if (source === "loadData") {
      return; // Skip this hook on loadData
    }
    if (changes) {
      for (const [row, prop, oldValue, newValue] of changes) {
        console.log(
          `Changed cell at row: ${row}, col: ${prop}, from: ${oldValue}, to: ${newValue}`
        );
      }
    }
  };

  const handleBeforeChange = (changes: any[]) => {
    if (!changes) return;

    for (let i = 0; i < changes.length; i++) {
      const [row, prop, oldValue, newValue] = changes[i];

      if ([4, 5, 6, 7, 9, 10].includes(prop)) {
        if (typeof newValue === "string") {
          const cleanedNewValue = newValue.replaceAll(/\./g, "");
          changes[i][3] = cleanedNewValue;
        }
      }
    }
  };

  const handleCreateAmortismanVerisi = async () => {
    if (fetchedData.filter((item: any) => item[0]).length == 0) {
      await handleDeleteAmortismanVerisi();
      return;
    }
    const keys = [
      "denetciId",
      "denetlenenId",
      "yil",
      "detayHesapKodu",
      "hesapAdi",
      "amortismanBaslangicTarihi",
      "eldenCikarmaTarihi",
      "girisTutari",
      "yenidenDegerlemeArtisi",
      "iptalEdilecekYenidenDegerlemeTutari",
      "kalintiDeger",
      "amortismanUsulu",
      "bobiTfrsFaydaliOmur",
      "vukFaydaliOmur",
      "vukKistAmortisman",
      "vukBirikmisAmortismanEnflasyonMuhasebesiIcin",
    ];
    const jsonData = fetchedData
      .filter((item: any) => item[0])
      .map((item: any) => {
        let obj: { [key: string]: any } = {};
        keys.forEach((key, index) => {
          if (key === "denetciId") {
            obj[key] = denetciId;
          } else if (key === "denetlenenId") {
            obj[key] = denetlenenId;
          } else if (key === "yil") {
            obj[key] = yil;
          } else if (
            key === "amortismanBaslangicTarihi" ||
            key === "eldenCikarmaTarihi"
          ) {
            if (
              item[index - 3] == undefined ||
              item[index - 3] == null ||
              item[index - 3] == ""
            ) {
              obj[key] = null;
            } else {
              const rawValue = item[index - 3];
              const [day, month, year] = rawValue.split(".");
              obj[key] = new Date(
                `${year}-${month}-${day}T00:00:00Z`
              ).toISOString();
            }
          } else if (
            key === "yenidenDegerlemeArtisi" ||
            key === "iptalEdilecekYenidenDegerlemeTutari" ||
            key === "kalintiDeger"
          ) {
            if (
              item[index - 3] == undefined ||
              item[index - 3] == null ||
              item[index - 3] == ""
            ) {
              obj[key] = 0.0;
            } else {
              obj[key] = item[index - 3];
            }
          } else if (key === "amortismanUsulu") {
            if (
              item[index - 3] == undefined ||
              item[index - 3] == null ||
              item[index - 3] == ""
            ) {
              obj[key] = "Normal";
            } else {
              obj[key] = item[index - 3];
            }
          } else if (
            key === "bobiTfrsFaydaliOmur" ||
            key === "vukFaydaliOmur"
          ) {
            if (
              item[index - 3] == undefined ||
              item[index - 3] == null ||
              item[index - 3] == ""
            ) {
              obj[key] = 0;
            } else {
              obj[key] = item[index - 3];
            }
          } else {
            if (
              item[index - 3] == undefined ||
              item[index - 3] == null ||
              item[index - 3] == ""
            ) {
              obj[key] = null;
            } else {
              obj[key] = item[index - 3];
            }
          }
        });

        return obj;
      });

    try {
      const result = await createAmortismanVerisi("", jsonData);
      if (result) {
        await fetchData();
        enqueueSnackbar("Kaydedildi", {
          variant: "success",
          autoHideDuration: 5000,
          style: {
            backgroundColor:
              customizer.activeMode === "dark"
                ? theme.palette.success.light
                : theme.palette.success.main,
            maxWidth: "720px",
          },
        });
      } else {
        enqueueSnackbar("Kaydedilemedi", {
          variant: "error",
          autoHideDuration: 5000,
          style: {
            backgroundColor:
              customizer.activeMode === "dark"
                ? theme.palette.error.light
                : theme.palette.error.main,
            maxWidth: "720px",
          },
        });
      }
    } catch (error) {
      console.error("Bir hata oluştu:", error);
    }
  };

  const handleDeleteAmortismanVerisi = async () => {
    try {
      const result = await deleteAmortismanVerisi(
        "",
        denetciId || 0,
        denetlenenId || 0,
        yil || 0
      );
      if (result) {
        await fetchData();
        enqueueSnackbar("Kaydedildi", {
          variant: "success",
          autoHideDuration: 5000,
          style: {
            backgroundColor:
              customizer.activeMode === "dark"
                ? theme.palette.success.light
                : theme.palette.success.main,
            maxWidth: "720px",
          },
        });
      } else {
        enqueueSnackbar("Kaydedilemedi", {
          variant: "error",
          autoHideDuration: 5000,
          style: {
            backgroundColor:
              customizer.activeMode === "dark"
                ? theme.palette.error.light
                : theme.palette.error.main,
            maxWidth: "720px",
          },
        });
      }
    } catch (error) {
      console.error("Bir hata oluştu:", error);
    }
  };

  const fetchData = async () => {
    setEndRow(-1);
    try {
      const amortismanVerileri =
        await getAmortismanVerileriByDenetciDenetlenenYil(
          "",
          denetciId || 0,
          denetlenenId || 0,
          yil || 0
        );

      const rowsAll: any = [];
      let kaydedilmeTarihi: Date | null = null;
      let kaydedilmeTarihiFormatted: string | null = null;

      amortismanVerileri.forEach((veri: any) => {
        const veriTarih = new Date(veri.sonKaydedilmeTarihi);
        if (veriTarih && !isNaN(veriTarih.getTime())) {
          if (!kaydedilmeTarihi || veriTarih > kaydedilmeTarihi) {
            kaydedilmeTarihi = veriTarih;
            kaydedilmeTarihiFormatted = veriTarih.toLocaleString("tr-TR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
          }
        }

        const newRow: any = [
          veri.detayHesapKodu,
          veri.hesapAdi,
          veri.amortismanBaslangicTarihi !== null &&
          veri.amortismanBaslangicTarihi !== undefined
            ? veri.amortismanBaslangicTarihi
                .split("T")[0]
                .split("-")
                .reverse()
                .join(".")
            : null,
          veri.eldenCikarmaTarihi !== null &&
          veri.eldenCikarmaTarihi !== undefined
            ? veri.eldenCikarmaTarihi
                .split("T")[0]
                .split("-")
                .reverse()
                .join(".") != "01.01.0001"
              ? veri.eldenCikarmaTarihi
                  .split("T")[0]
                  .split("-")
                  .reverse()
                  .join(".")
              : null
            : null,
          veri.girisTutari,
          veri.yenidenDegerlemeArtisi,
          veri.iptalEdilecekYenidenDegerlemeTutari,
          veri.kalintiDeger,
          veri.amortismanUsulu,
          veri.bobiTfrsFaydaliOmur,
          veri.vukFaydaliOmur,
          veri.vukKistAmortisman,
        ];

        rowsAll.push(newRow);
      });
      setFetchedData(rowsAll);
      setDuplicatesControl(true);

      if (kaydedilmeTarihiFormatted) {
        setSonKaydedilmeTarihi(kaydedilmeTarihiFormatted);
      }
    } catch (error) {
      console.error("Bir hata oluştu:", error);
    }
  };

  const fetchRowCount = async () => {
    try {
      const format = await getFormat("", "Amortisman");
      setRowCount(format.satirSayisi);
    } catch (error) {
      console.error("Bir hata oluştu:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchRowCount();
  }, []);

  useEffect(() => {
    if (kaydetTiklandimi) {
      handleCreateAmortismanVerisi();
      setKaydetTiklandimi(false);
    }
  }, [kaydetTiklandimi]);

  const handleDownload = () => {
    const hotTableInstance = hotTableComponent.current.hotInstance;
    const data = hotTableInstance.getData();

    const processedData = data.map((row: any) => row);

    const headers = hotTableInstance.getColHeader();

    const fullData = [headers, ...processedData];

    async function createExcelFile() {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sayfa1");

      fullData.forEach((row: any) => {
        worksheet.addRow(row);
      });

      const headerRow = worksheet.getRow(1);
      headerRow.font = {
        name: "Calibri",
        size: 12,
        bold: true,
        color: { argb: "FFFFFF" },
      };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1a6786" },
      };
      headerRow.alignment = { horizontal: "left" };

      worksheet.columns.forEach((column) => {
        column.width = 25;
      });

      try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(blob, "AmortismanFormati.xlsx");
        console.log("Excel dosyası başarıyla oluşturuldu");
      } catch (error) {
        console.error("Excel dosyası oluşturulurken bir hata oluştu:", error);
      }
    }
    createExcelFile();
  };

  useEffect(() => {
    if (hotTableComponent.current) {
      const diff = customizer.isCollapse
        ? 0
        : customizer.SidebarWidth && customizer.MiniSidebarWidth
        ? customizer.SidebarWidth - customizer.MiniSidebarWidth
        : 0;

      hotTableComponent.current.hotInstance.updateSettings({
        width: customizer.isCollapse
          ? "100%"
          : hotTableComponent.current.hotInstance.rootElement.clientWidth -
            diff,
      });
    }
  }, [customizer.isCollapse]);

  return (
    <>
      <Grid container>
        <Grid item xs={12} lg={12}>
          <Paper
            elevation={2}
            sx={{
              p: 1,
              mb: 2,
              borderRadius: 1,
              backgroundColor: "warning.light",
            }}
          >
            {uyari.map((mesaj, index) => (
              <Typography
                key={index}
                variant="body1"
                sx={{ color: "warning.dark" }}
              >
                - {mesaj}
              </Typography>
            ))}
          </Paper>
        </Grid>
      </Grid>
      <HotTable
        style={{
          height: "100%",
          width: "100%",
          maxHeight: 684,
          maxWidth: "100%",
        }}
        language={dictionary.languageCode}
        ref={hotTableComponent}
        data={fetchedData}
        height={684}
        colHeaders={colHeaders}
        columns={columns}
        colWidths={[90, 150, 100, 110, 100, 100, 100, 100, 100, 80, 80, 80]}
        stretchH="all"
        manualColumnResize={true}
        rowHeaders={true}
        rowHeights={35}
        autoWrapRow={true}
        minRows={rowCount}
        minCols={10}
        filters={true}
        columnSorting={true}
        dropdownMenu={[
          "filter_by_condition",
          "filter_by_value",
          "filter_action_bar",
        ]}
        licenseKey="non-commercial-and-evaluation" // For non-commercial use only
        afterGetColHeader={afterGetColHeader}
        afterGetRowHeader={afterGetRowHeader}
        afterRenderer={afterRenderer}
        afterPaste={afterPaste} // Add afterPaste hook
        afterChange={handleAfterChange} // Add afterChange hook
        beforeChange={handleBeforeChange} // Add beforeChange hook
        afterCreateRow={handleCreateRow} // Add createRow hook
        afterRemoveRow={handleAfterRemoveRow} // Add afterRemoveRow hook
        contextMenu={[
          "row_above",
          "row_below",
          "remove_row",
          "alignment",
          "copy",
        ]}
      />
      <Grid container marginTop={2}>
        <Grid
          item
          xs={12}
          lg={12}
          sx={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <ExceleAktarButton
            handleDownload={handleDownload}
          ></ExceleAktarButton>
        </Grid>
      </Grid>
    </>
  );
};

export default AmortismanVeriYukleme;
