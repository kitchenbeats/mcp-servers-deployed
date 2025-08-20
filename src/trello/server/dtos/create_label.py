from pydantic import BaseModel


class CreateLabelPayload(BaseModel):
    """
    Payload for creating a label.

    Attributes:
        name (str): The name of the label.
        color (str): The color of the label.
    """

    name: str
    color: str | None = None