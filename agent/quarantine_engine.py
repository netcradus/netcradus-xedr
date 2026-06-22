import os
import shutil
from datetime import datetime


QUARANTINE_FOLDER = "quarantine"


def quarantine_file(file_path):

    try:

        if not os.path.exists(
                QUARANTINE_FOLDER):

            os.makedirs(
                QUARANTINE_FOLDER
            )

        if not os.path.exists(
                file_path):

            return False

        filename = os.path.basename(
            file_path
        )

        timestamp = datetime.now().strftime(
            "%Y%m%d_%H%M%S"
        )

        destination = os.path.join(

            QUARANTINE_FOLDER,

            f"{timestamp}_{filename}"

        )

        shutil.move(

            file_path,

            destination

        )

        print(
            f"[QUARANTINED] {destination}"
        )

        return True

    except Exception as e:

        print(
            f"[QUARANTINE ERROR] {e}"
        )

        return False