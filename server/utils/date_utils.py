from datetime import datetime, timedelta

# ---------------------------------------
#  Time classification 
# ---------------------------------------
def get_period_of_day(timestamp):
    hour = timestamp
    if hour < 12:
        return 'Morning'
    elif hour < 17:
        return 'Afternoon'
    return 'Evening'