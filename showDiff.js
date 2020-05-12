"use strict";

const ALL_PREFECTURES = [
  "北海道",
  "青森",
  "岩手",
  "宮城",
  "秋田",
  "山形",
  "福島",
  "茨城",
  "栃木",
  "群馬",
  "埼玉",
  "千葉",
  "東京",
  "神奈川",
  "新潟",
  "富山",
  "石川",
  "福井",
  "山梨",
  "長野",
  "岐阜",
  "静岡",
  "愛知",
  "三重",
  "滋賀",
  "京都",
  "大阪",
  "兵庫",
  "奈良",
  "和歌山",
  "鳥取",
  "島根",
  "岡山",
  "広島",
  "山口",
  "徳島",
  "香川",
  "愛媛",
  "高知",
  "福岡",
  "佐賀",
  "長崎",
  "熊本",
  "大分",
  "宮崎",
  "鹿児島",
  "沖縄",
];

// array1 + array2
const arrayAdd = (array1, array2) => {
  return array1.map((n, i) => n + array2[i]);
};
// k * array
const arrayScalarProd = (k, array) => {
  return array.map((n) => k * n);
};
// sum of array
const arraySum = (array) => {
  return array.reduce((a, b) => a + b, 0);
};

const assocToMap = (assoc) => {
  let result = {};
  assoc.forEach((tuple) => {
    result[tuple[0]] = values[tuple[1]];
  });
  return result;
};

const zipToMap = (keys, values) => {
  let result = {};
  keys.forEach((key, index) => {
    result[key] = values[index];
  });
  return result;
};

const dateString = (year, month, day) => {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

// pref: "total" | pref number
const prefIsTotal = (pref) => {
  return pref === "total";
};

/*
 * result
 *   "daily" | "accum"
 *     day
 *       "total" | pref[pref number]
 *         "muni" | "mhlw" | "mhlwTentative"
 *   days
 */

const getInitialResult = () => {
  return {
    daily: {},
    accum: {},
  };
};

// source: "muni" | "mhlw" | "mhlwTentative"
// pref: "total" | pref number
const setResult = (result, day, source, pref, dailyNum, accumNum) => {
  [
    [result.daily, dailyNum],
    [result.accum, accumNum],
  ].forEach((tuple) => {
    const target = tuple[0];
    const num = tuple[1];

    // initialize
    if (!target[day]) {
      target[day] = {
        total: { muni: null, mhlw: null, mhlwTentative: null },
        pref: ALL_PREFECTURES.map((p) => ({
          muni: null,
          mhlw: null,
          /* mhlwTentative: null, */
        })),
      };
    }

    if (prefIsTotal(pref)) {
      target[day].total[source] = num;
    } else {
      target[day].pref[pref][source] = num;
    }
  });
};

const setResultDays = (result) => {
  result.days = Object.keys(result.daily).sort();
};

//// fetch data

const getNcovData = async (result) => {
  const csvTextData = await (
    await fetch(
      "https://raw.githubusercontent.com/swsoyee/2019-ncov-japan/master/50_Data/death.csv"
    )
  ).text();
  const lines = csvTextData
    .replace("\r", "")
    .split("\n")
    .filter((line) => line.indexOf(",") != -1);
  const csvPrefs = lines[0].split(",").slice(1, 48);
  const csvData = lines.slice(1).map((str) => {
    const strs = str.split(",");
    const date = dateString(
      strs[0].slice(0, 4),
      strs[0].slice(4, 6),
      strs[0].slice(6, 8)
    );
    const dailyToll = strs
      .slice(1, 48)
      .map((str) => (str === "" ? 0 : parseInt(str)));
    return { date: date, dailyToll: dailyToll };
  });

  csvData.forEach((obj, index) => {
    if (index === 0) {
      obj.accumToll = obj.dailyToll;
    } else {
      obj.accumToll = arrayAdd(obj.dailyToll, csvData[index - 1].accumToll);
    }
    obj.dailyTotalToll = arraySum(obj.dailyToll);
    obj.accumTotalToll = arraySum(obj.accumToll);
  });

  csvData.forEach((obj) => {
    const dailyTollMap = zipToMap(csvPrefs, obj.dailyToll);
    const accumTollMap = zipToMap(csvPrefs, obj.accumToll);
    ALL_PREFECTURES.forEach((pref, prefIndex) => {
      setResult(
        result,
        obj.date,
        "muni",
        prefIndex,
        dailyTollMap[pref],
        accumTollMap[pref]
      );
    });
    setResult(
      result,
      obj.date,
      "muni",
      "total",
      obj.dailyTotalToll,
      obj.accumTotalToll
    );
  });
  return result;
};

const getMhlwData = async (result) => {
  const jsonData = await (
    await fetch(
      "https://raw.githubusercontent.com/kaz-ogiwara/covid19/master/data/data.json"
    )
  ).json();
  const overwriteJsonData = await (await fetch("./Overwrite.json")).json();
  const accumJsonData = jsonData["prefectures-data"].deaths.map((arr) => {
    return {
      date: dateString(arr[0], arr[1], arr[2]),
      accumToll: arr.slice(3),
    };
  });
  overwriteJsonData.accumTollOfMhlw.forEach((arr, prefIndex) => {
    if (arr) {
      accumJsonData.forEach((obj) => {
        if (obj.date in arr) {
          obj.accumToll[prefIndex] = arr[obj.date];
        }
      });
    }
  });
  accumJsonData.forEach((obj, index) => {
    if (index === 0) {
      obj.dailyToll = obj.accumToll;
    } else {
      obj.dailyToll = arrayAdd(
        obj.accumToll,
        arrayScalarProd(-1, accumJsonData[index - 1].accumToll)
      );
    }
  });

  const totalTolls = jsonData.transition.deaths.map((arr) => {
    const date = dateString(arr[0], arr[1], arr[2]);
    return {
      date: date,
      accumTotalToll:
        date < "2020-04-13"
          ? arr[3]
          : date < "2020-05-08"
          ? accumJsonData
              .filter((obj) => obj.date === date)
              .map((obj) => arraySum(obj.accumToll))[0] || null
          : null,
      accumTentativeTotalToll: date >= "2020-04-13" ? arr[3] : null,
    };
  });
  totalTolls.forEach((obj, index) => {
    if (index === 0) {
      obj.dailyTotalToll = obj.accumTotalToll;
      obj.dailyTentativeTotalToll = obj.accumTentativeTotalToll;
    } else {
      obj.dailyTotalToll =
        obj.accumTotalToll === null ||
        totalTolls[index - 1].accumTotalToll === null
          ? null
          : obj.accumTotalToll - totalTolls[index - 1].accumTotalToll;
      obj.dailyTentativeTotalToll =
        obj.accumTentativeTotalToll === null ||
        totalTolls[index - 1].accumTentativeTotalToll === null
          ? null
          : obj.accumTentativeTotalToll -
            totalTolls[index - 1].accumTentativeTotalToll;
    }
  });

  totalTolls.forEach((obj) => {
    setResult(
      result,
      obj.date,
      "mhlw",
      "total",
      obj.dailyTotalToll,
      obj.accumTotalToll
    );
    setResult(
      result,
      obj.date,
      "mhlwTentative",
      "total",
      obj.dailyTentativeTotalToll,
      obj.accumTentativeTotalToll
    );
  });
  accumJsonData.forEach((obj) => {
    if (obj.date <= "2020-05-07") {
      ALL_PREFECTURES.forEach((pref, prefIndex) => {
        setResult(
          result,
          obj.date,
          "mhlw",
          prefIndex,
          obj.dailyToll[prefIndex],
          obj.accumToll[prefIndex]
        );
      });
    } else {
      ALL_PREFECTURES.forEach((pref, prefIndex) => {
        setResult(
          result,
          obj.date,
          "mhlwTentative",
          prefIndex,
          obj.dailyToll[prefIndex],
          obj.accumToll[prefIndex]
        );
      });
    }
  });
  return result;
};

//// controls

const getControls = () => {
  const getCheckedValueFromNodeList = (nodeList) => {
    return Array.from(nodeList)
      .filter((n) => n.checked)
      .map((n) => n.value)[0];
  };
  const fixPref = (value) => {
    if (value === "total") {
      return value;
    } else {
      return parseInt(value);
    }
  };
  return {
    accumType: getCheckedValueFromNodeList(
      document.querySelectorAll(".control input[name=accumType]")
    ),
    pref: fixPref(document.querySelector(".control select[name=pref]").value),
    yScale: getCheckedValueFromNodeList(
      document.querySelectorAll(".control input[name=yScale]")
    ),
    minDate: document.querySelector(".control input[name=minDate]").value || "",
  };
};

const setPrefSelect = (select, result, lastDay) => {
  ALL_PREFECTURES.forEach((pref, prefIndex) => {
    const obj = result.accum[lastDay].pref[prefIndex];
    const n = Math.max(obj.muni || 0, obj.mhlw || 0);

    let option = document.createElement("option");
    option.setAttribute("value", prefIndex);
    if (n === 0) {
      option.setAttribute("disabled", "disabled");
    }
    option.textContent = `${pref} (${n})`;
    select.appendChild(option);
  });
};

const bindEvents = (config, canvas, result) => {
  const event = (e) => {
    showChart(config, canvas, result, getControls());
  };
  document.querySelectorAll(".control input").forEach((elem) => {
    elem.addEventListener("change", event);
  });
  document.querySelectorAll(".control select").forEach((elem) => {
    elem.addEventListener("change", event);
  });
};

//// chart

const showChart = (config, canvas, result, controlConfig) => {
  const labels = result.days
    .filter((day) => day >= controlConfig.minDate)
    .sort();
  config.data.labels = labels;

  const targetObjs = labels.map((day) => {
    if (controlConfig.pref === "total") {
      return result[controlConfig.accumType][day].total;
    } else {
      return result[controlConfig.accumType][day].pref[controlConfig.pref];
    }
  });
  config.data.datasets[0].data = targetObjs.map((obj) => obj.mhlwTentative);
  config.data.datasets[1].data = targetObjs.map((obj) => obj.mhlw);
  config.data.datasets[2].data = targetObjs.map((obj) => obj.muni);

  config.options.scales.yAxes[0].type = controlConfig.yScale;
  if (controlConfig.accumType === "accum") {
    config.options.scales.yAxes[0].ticks.min = 0;
  } else {
    if ("min" in config.options.scales.yAxes[0].ticks) {
      delete config.options.scales.yAxes[0].ticks.min;
    }
  }
  if (window.chart) {
    window.chart.update(config);
  } else {
    window.chart = new Chart(canvas.getContext("2d"), config);
  }
};

const init = async () => {
  let config = {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "厚労省確認中",
          backgroundColor: Color("#16db19").alpha(0.5).rgbString(),
          borderColor: "#16db19",
          fill: false,
          lineTension: 0,
          data: [],
        },
        {
          label: "厚労省突合済",
          backgroundColor: Color("#1654db").alpha(0.5).rgbString(),
          borderColor: "#1654db",
          fill: false,
          lineTension: 0,
          data: [],
        },
        {
          label: "自治体発表",
          backgroundColor: Color("#db7216").alpha(0.5).rgbString(),
          borderColor: "#db7216",
          fill: false,
          lineTension: 0,
          data: [],
        },
      ],
    },
    options: {
      title: {
        text: "死亡者数",
      },
      tooltips: {
        mode: "index",
        intersect: false,
      },
      scales: {
        xAxes: [
          {
            position: "bottom",
            gridLines: {
              display: false,
            },
            ticks: {
              suggestedMin: 0,
              maxRotation: 0,
              minRotation: 0,
              callback: (label) => {
                return " " + label + " ";
              },
            },
          },
        ],
        yAxes: [
          {
            scaleLabel: {
              display: true,
              labelString: "死亡者数",
            },
            type: "linear",
            ticks: {},
          },
        ],
      },
    },
  };

  let result = getInitialResult();
  result = await getNcovData(result);
  result = await getMhlwData(result);
  setResultDays(result);

  setPrefSelect(
    document.querySelector(".control select[name=pref]"),
    result,
    result.days[result.days.length - 1]
  );
  showChart(config, document.getElementById("canvas"), result, getControls());
  bindEvents(config, document.getElementById("canvas"), result);
  return result;
};

init().then();
