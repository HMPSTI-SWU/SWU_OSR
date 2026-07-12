# Contributing to SWU OSR

First off, thank you for considering contributing to SWU OSR! It's people like you that make SWU OSR such a great platform.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](../../issues) to see if someone else has already created a ticket. If not, go ahead and make one!

## Fork & create a branch

If this is something you think you can fix, then fork SWU OSR and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```
git checkout -b 325-add-new-feature
```

## Implement your fix or feature

At this point, you're ready to make your changes! Feel free to ask for help; everyone is a beginner at first.

## Make a Pull Request

At this point, you should switch back to your master branch and make sure it's up to date with SWU OSR's master branch:

```
git remote add upstream https://github.com/HMPSTI-SWU/SWU_OSR.git
git checkout master
git pull upstream master
```

Then update your feature branch from your local copy of master, and push it!

```
git checkout 325-add-new-feature
git rebase master
git push --set-upstream origin 325-add-new-feature
```

Finally, go to GitHub and make a Pull Request.

## Keeping your Pull Request updated

If a maintainer asks you to "rebase" your PR, they're saying that a lot of code has changed, and that you need to update your branch so it's easier to merge.

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
