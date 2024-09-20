## Initial Prompt

Create a nodeJS script that will do the following:

1. Collect all Markdown files in a specific folder.
	a. The specific folder is a path coming from an environmental variable called `INPUT_PATH`. First verify if this environmental variable is defined or not.
	b. If this environmental variable exists, try to collect the markdown files. If the path cannot be found or there are no markdown files in it, log an appropriate message to the Terminal.
	c. If there isn't any value for `INPUT_PATH`, take `./input-files` as a path. If the folder doesn't exist, create it. If the folder doesn't have any markdown files in it, log an app message to the terminal.
2. Iterate through markdown files you collected from step 1 and do the following for each single file:
	a. Copy the contents of the markdown file into two string variable named `originalContents` and another called `filteredContents`.
	b. Remove the YAML front matter from the `filteredContents` variable.
	c. Take the name of the markdown file and add it as a H1 title at the beginning of the `filteredContents` variable.
	d. Remove any markdown image or link from the `filteredContents` variable.
	e. Add a property to the YAML front matter of the `originalContents` with the key "Foo" and the value "Bar"
	f. Create a duplicate markdown file with the `originalContents` variable as contents into a specific folder. By default, the folder's path will be `./output-files` (create the folder if it doesn't exists), but if an environmental `OUTPUT_PATH` variable exists, use it instead.