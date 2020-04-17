"use strict";

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
  return array.reduce((a, b) => a + b);
};

const dateString = (year, month, day) => {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const getNcovData = async () => {
  // get death toll from https://github.com/swsoyee/2019-ncov-japan/blob/master/50_Data/death.csv
  //   which is MIT licensed https://github.com/swsoyee/2019-ncov-japan/blob/master/LICENSE
  const csvTextData = await (
    await fetch(
      "https://raw.githubusercontent.com/swsoyee/2019-ncov-japan/master/50_Data/death.csv"
    )
  ).text();
  const lines = csvTextData.replace("\r", "").split("\n");
  const prefs = lines[0].split(",").slice(1, 48);
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

  let result = {};
  result.prefs = prefs;
  result.daysSet = new Set();
  result.muni = {
    daily: { total: {}, prefs: {} },
    accum: { total: {}, prefs: {} },
  };
  csvData.forEach((obj) => {
    result.daysSet.add(obj.date);
    result.muni.daily.total[obj.date] = obj.dailyTotalToll;
    result.muni.daily.prefs[obj.date] = obj.dailyToll;
    result.muni.accum.total[obj.date] = obj.accumTotalToll;
    result.muni.accum.prefs[obj.date] = obj.accumToll;
  });
  return result;
};

const getMhlwData = async (result) => {
  // https://github.com/kaz-ogiwara/covid19/blob/master/data/data.json
  // https://github.com/kaz-ogiwara/covid19/blob/master/LICENSE
  const jsonData = await (
    await fetch(
      "https://raw.githubusercontent.com/kaz-ogiwara/covid19/master/data/data.json"
    )
  ).json();
  const totalTollsOffset = jsonData.transition.deaths.map((arr) => {
    return {
      date: dateString(arr[0], arr[1], arr[2]),
      accumTotalTollOfMhlw: arr[3],
    };
  });
  // fix total death tolls date offset
  const totalTolls = totalTollsOffset.slice(1).map((obj, index) => {
    return {
      date: totalTollsOffset[index].date,
      accumTotalTollOfMhlw: obj.accumTotalTollOfMhlw,
    };
  });
  totalTolls.forEach((obj, index) => {
    if (index === 0) {
      obj.dailyTotalTollOfMhlw = obj.accumTotalTollOfMhlw;
    } else {
      obj.dailyTotalTollOfMhlw =
        obj.accumTotalTollOfMhlw - totalTolls[index - 1].accumTotalTollOfMhlw;
    }
  });
  const accumJsonData = jsonData["prefectures-data"].deaths.map((arr) => {
    return {
      date: dateString(arr[0], arr[1], arr[2]),
      accumTollOfMhlw: arr.slice(3),
    };
  });
  accumJsonData.forEach((obj, index) => {
    if (index === 0) {
      obj.dailyTollOfMhlw = obj.accumTollOfMhlw;
    } else {
      obj.dailyTollOfMhlw = arrayAdd(
        obj.accumTollOfMhlw,
        arrayScalarProd(-1, accumJsonData[index - 1].accumTollOfMhlw)
      );
    }
  });

  result.mhlw = {
    daily: { total: {}, prefs: {} },
    accum: { total: {}, prefs: {} },
  };
  totalTolls.forEach((obj) => {
    result.daysSet.add(obj.date);
    result.mhlw.daily.total[obj.date] = obj.dailyTotalTollOfMhlw;
    result.mhlw.accum.total[obj.date] = obj.accumTotalTollOfMhlw;
  });
  accumJsonData.forEach((obj) => {
    result.daysSet.add(obj.date);
    result.mhlw.daily.prefs[obj.date] = obj.dailyTollOfMhlw;
    result.mhlw.accum.prefs[obj.date] = obj.accumTollOfMhlw;
  });
  return result;
};

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
    isAccum:
      getCheckedValueFromNodeList(
        document.querySelectorAll(".control input[name=isAccum]")
      ) === "accum",
    pref: fixPref(document.querySelector(".control select[name=pref]").value),
    useLogScale:
      getCheckedValueFromNodeList(
        document.querySelectorAll(".control input[name=useLogScale]")
      ) === "log",
    minDate: document.querySelector(".control input[name=minDate]").value || "",
  };
};

const setPrefSelect = (select, prefs, totalCount) => {
  prefs.forEach((pref, index) => {
    let option = document.createElement("option");
    option.setAttribute("value", index);
    option.textContent = `${pref} (${totalCount[index]})`;
    select.appendChild(option);
  });
};

const bindEvents = (config, canvas, chartData) => {
  const event = (e) => {
    showChart(config, canvas, chartData, getControls());
  };
  document.querySelectorAll(".control input").forEach((elem) => {
    elem.addEventListener("change", event);
  });
  document.querySelectorAll(".control select").forEach((elem) => {
    elem.addEventListener("change", event);
  });
};

// window.chart
// pref: index of pref or "total" for total
const showChart = (config, canvas, chartData, controlConfig) => {
  const labels = chartData.days
    .filter((day) => day >= controlConfig.minDate)
    .sort();
  config.data.labels = labels;
  const isAccumKey = controlConfig.isAccum ? "accum" : "daily";
  if (controlConfig.pref === "total") {
    config.data.datasets[0].data = labels.map(
      (day) => chartData.mhlw[isAccumKey].total[day]
    );
    config.data.datasets[1].data = labels.map(
      (day) => chartData.muni[isAccumKey].total[day]
    );
  } else {
    config.data.datasets[0].data = labels.map(
      (day) => (chartData.mhlw[isAccumKey].prefs[day] || [])[controlConfig.pref]
    );
    config.data.datasets[1].data = labels.map(
      (day) => (chartData.muni[isAccumKey].prefs[day] || [])[controlConfig.pref]
    );
  }
  if (controlConfig.useLogScale) {
    config.options.scales.yAxes[0].type = "logarithmic";
  } else {
    config.options.scales.yAxes[0].type = "linear";
  }
  if (controlConfig.isAccum) {
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
          label: "厚労省発表",
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

  let result = await getNcovData();
  result = await getMhlwData(result);
  result.days = Array.from(result.daysSet).sort();
  delete result.daysSet;
  setPrefSelect(
    document.querySelector(".control select[name=pref]"),
    result.prefs,
    result.muni.accum.prefs[result.days[result.days.length - 1]]
  );
  showChart(config, document.getElementById("canvas"), result, getControls());
  bindEvents(config, document.getElementById("canvas"), result);
  return result;
};

init().then();
