import urllib.request
import json
import pandas as pd

races = [
    {"city": "boston", "lat": 42.3601, "lon": -71.0589, "dates": ["2013-04-15", "2014-04-21", "2015-04-20", "2016-04-18", "2017-04-17", "2018-04-16", "2019-04-15"]},
    {"city": "berlin", "lat": 52.5200, "lon": 13.4050, "dates": ["2013-09-29", "2014-09-28", "2015-09-27", "2016-09-25", "2017-09-24", "2018-09-16", "2019-09-29"]},
    {"city": "chicago", "lat": 41.8781, "lon": -87.6298, "dates": ["2013-10-13", "2014-10-12", "2015-10-11", "2016-10-09", "2017-10-08", "2018-10-07", "2019-10-13"]},
    {"city": "nyc", "lat": 40.7128, "lon": -74.0060, "dates": ["2013-11-03", "2014-11-02", "2015-11-01", "2016-11-06", "2017-11-05", "2018-11-04", "2019-11-03"]}
]

weather_data = []

for race in races:
    lat = race["lat"]
    lon = race["lon"]
    for date in race["dates"]:
        url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={date}&end_date={date}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,cloud_cover"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                
                # Average the hourly data for the typical race window (9AM to 2PM, indices 9 to 14)
                temp = sum(data["hourly"]["temperature_2m"][9:15]) / 6
                rh = sum(data["hourly"]["relative_humidity_2m"][9:15]) / 6
                wind_speed = sum(data["hourly"]["wind_speed_10m"][9:15]) / 6
                wind_dir = sum(data["hourly"]["wind_direction_10m"][9:15]) / 6
                precip = sum(data["hourly"]["precipitation"][9:15])
                pressure = sum(data["hourly"]["surface_pressure"][9:15]) / 6
                cloud = sum(data["hourly"]["cloud_cover"][9:15]) / 6
                
                # Convert wind from km/h to m/s
                wind_speed_mps = wind_speed * 1000 / 3600
                
                weather_data.append({
                    "city": race["city"],
                    "date": date,
                    "temperature_c": round(temp, 1),
                    "relative_humidity_pct": round(rh, 1),
                    "wind_speed_mps": round(wind_speed_mps, 1),
                    "wind_direction_deg": round(wind_dir, 1),
                    "precipitation_mm": round(precip, 1),
                    "pressure_hpa": round(pressure, 1),
                    "cloud_cover_pct": round(cloud, 1)
                })
        except Exception as e:
            print(f"Failed to get weather for {race['city']} on {date}: {e}")

df = pd.DataFrame(weather_data)
df.to_csv("weather_data.csv", index=False)
print(f"Downloaded {len(df)} weather records to weather_data.csv.")
